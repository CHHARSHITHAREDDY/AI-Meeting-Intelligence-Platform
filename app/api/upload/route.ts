import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/whisper';
import { extractMeetingInsights, extractLectureInsights, extractCodingInsights, extractPodcastInsights } from '@/lib/extract';
import { classifyContentType, ContentType } from '@/lib/classify';
import { saveMeeting, Meeting, MeetingAnalysis } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
// @ts-ignore
import { YoutubeTranscript } from 'youtube-transcript';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';
 
function getYoutubeVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

async function fetchYoutubeTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/<title>(.*?)<\/title>/i);
      if (match && match[1]) {
        return match[1].replace(/\s*-\s*YouTube$/i, '').trim();
      }
    }
  } catch (err) {
    console.warn('Failed to fetch YouTube title:', err);
  }
  return 'YouTube Video';
}

function parseRawMultipart(buffer: Buffer, contentTypeHeader: string): { fileBuffer: Buffer | null; fileName: string; title: string; link: string } {
  let fileBuffer: Buffer | null = null;
  let fileName = '';
  let title = '';
  let link = '';

  const boundaryMatch = contentTypeHeader.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return { fileBuffer, fileName, title, link };

  const boundary = (boundaryMatch[1] || boundaryMatch[2]).trim();
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  
  let offset = 0;
  const parts: Buffer[] = [];

  while (offset < buffer.length) {
    const idx = buffer.indexOf(boundaryBuffer, offset);
    if (idx === -1) break;
    if (offset > 0) {
      parts.push(buffer.subarray(offset, idx));
    }
    offset = idx + boundaryBuffer.length;
  }

  for (const part of parts) {
    const headerEndIdx = part.indexOf('\r\n\r\n');
    if (headerEndIdx === -1) continue;

    const headerText = part.subarray(0, headerEndIdx).toString('utf-8');
    let bodyBuffer = part.subarray(headerEndIdx + 4);

    if (bodyBuffer.length >= 2 && bodyBuffer[bodyBuffer.length - 2] === 13 && bodyBuffer[bodyBuffer.length - 1] === 10) {
      bodyBuffer = bodyBuffer.subarray(0, bodyBuffer.length - 2);
    }

    const nameMatch = headerText.match(/name="([^"]+)"/i);
    const filenameMatch = headerText.match(/filename="([^"]+)"/i);

    if (nameMatch) {
      const fieldName = nameMatch[1];
      if (fieldName === 'file' || filenameMatch) {
        fileBuffer = bodyBuffer;
        fileName = filenameMatch ? filenameMatch[1] : 'uploaded_file';
      } else if (fieldName === 'title') {
        title = bodyBuffer.toString('utf-8').trim();
      } else if (fieldName === 'link') {
        link = bodyBuffer.toString('utf-8').trim();
      }
    }
  }

  return { fileBuffer, fileName, title, link };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    let title = '';
    let audioInput: Buffer | Float32Array | null = null;
    let fileName = '';
    let transcript = '';
    let isLinkTranscribed = false;

    if (contentType.includes('application/octet-stream')) {
      const url = new URL(request.url);
      title = url.searchParams.get('title') || 'Local Recording';
      fileName = 'audio.pcm';
      const arrayBuffer = await request.arrayBuffer();
      audioInput = new Float32Array(arrayBuffer);
    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      title = body.title || '';
      const link = body.link || '';
      if (link && link.trim() !== '') {
        const videoId = getYoutubeVideoId(link.trim());
        if (videoId) {
          console.log('[Upload API] YouTube URL detected:', videoId);
          if (!title) {
            title = await fetchYoutubeTitle(videoId);
          }
          const segments = await YoutubeTranscript.fetchTranscript(videoId);
          transcript = segments.map((s: any) => s.text).join(' ');
          isLinkTranscribed = true;
          fileName = 'youtube';
        } else {
          console.log('[Upload API] Generic media link detected:', link);
          if (!title) {
            const urlParts = link.split('/');
            const lastPart = urlParts[urlParts.length - 1] || 'media';
            title = lastPart.split('?')[0];
          }
          const fileRes = await fetch(link.trim());
          if (!fileRes.ok) {
            throw new Error(`Failed to download audio from link: HTTP ${fileRes.status}`);
          }
          const arrayBuffer = await fileRes.arrayBuffer();
          audioInput = Buffer.from(arrayBuffer);
          fileName = title;
        }
      } else {
        return NextResponse.json({ error: 'No file or link provided in JSON body' }, { status: 400 });
      }
    } else {
      let file: File | null = null;
      let link: string | null = null;

      try {
        const formData = await request.formData();
        file = formData.get('file') as File | null;
        link = formData.get('link') as string | null;
        title = (formData.get('title') as string) || '';
      } catch (err: any) {
        console.warn('[Upload API] Native request.formData() failed, falling back to arrayBuffer multipart parser:', err.message);
        try {
          const rawBuffer = Buffer.from(await request.arrayBuffer());
          const parsed = parseRawMultipart(rawBuffer, contentType);
          if (parsed.fileBuffer) {
            audioInput = parsed.fileBuffer;
            fileName = parsed.fileName;
          }
          if (parsed.title) title = parsed.title;
          if (parsed.link) link = parsed.link;
        } catch (rawErr: any) {
          console.error('[Upload API] Raw multipart parse error:', rawErr);
        }
      }

      if (!audioInput && link && link.trim() !== '') {
        const videoId = getYoutubeVideoId(link.trim());
        if (videoId) {
          console.log('[Upload API] YouTube URL detected:', videoId);
          if (!title) {
            title = await fetchYoutubeTitle(videoId);
          }
          const segments = await YoutubeTranscript.fetchTranscript(videoId);
          transcript = segments.map((s: any) => s.text).join(' ');
          isLinkTranscribed = true;
          fileName = 'youtube';
        } else {
          console.log('[Upload API] Generic media link detected:', link);
          if (!title) {
            const urlParts = link.split('/');
            const lastPart = urlParts[urlParts.length - 1] || 'media';
            title = lastPart.split('?')[0];
          }
          const fileRes = await fetch(link.trim());
          if (!fileRes.ok) {
            throw new Error(`Failed to download audio from link: HTTP ${fileRes.status}`);
          }
          const arrayBuffer = await fileRes.arrayBuffer();
          audioInput = Buffer.from(arrayBuffer);
          fileName = title;
        }
      } else if (!audioInput && file) {
        title = title || file.name.replace(/\.[^/.]+$/, "");
        fileName = file.name;
        const arrayBuffer = await file.arrayBuffer();
        audioInput = Buffer.from(arrayBuffer);
      }

      if (!audioInput && !isLinkTranscribed) {
        return NextResponse.json({ error: 'No valid audio/video file or media link received.' }, { status: 400 });
      }
    }

    const id = Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
    
    // Save initial processing state
    const newMeeting: Meeting = {
      id,
      title: title || 'Web Link Analysis',
      date: new Date().toISOString(),
      duration: 'Processing...',
      transcript: '',
      status: 'processing',
    };
    
    await saveMeeting(newMeeting, user.userId);

    try {
      if (!isLinkTranscribed && audioInput) {
        console.log(`Transcribing audio file: ${fileName}...`);
        transcript = await transcribeAudio(audioInput, fileName);
      }
      
      console.log('Classifying content type...');
      const classification = await classifyContentType(transcript);
      console.log(`[Upload API] Detected content type: ${classification.contentType} (${classification.confidence}% confidence)`);

      console.log(`Extracting ${classification.contentType} insights...`);
      const insights = await extractInsightsForType(transcript, classification.contentType);
      insights.contentType = classification.contentType;
      insights.contentTypeConfidence = classification.confidence;

      // Calculate duration based on word count
      const wordCount = transcript.split(/\s+/).length;
      const minutes = Math.floor(wordCount / 130) || 1;
      const seconds = Math.floor((wordCount % 130) * 0.46) % 60;
      const durationStr = `${minutes}m ${seconds}s`;

      newMeeting.transcript = transcript;
      newMeeting.analysis = insights;
      newMeeting.duration = durationStr;
      newMeeting.status = 'completed';

      // Index meeting context for the RAG chat pipeline. This is a secondary
      // enhancement (chat context chunking) — a failure here must NOT discard
      // the transcript + summary we already have, so it's isolated in its own
      // try/catch instead of sharing the outer one (previously, any error in
      // this step would mark an otherwise fully-successful meeting as
      // 'failed', hiding a real transcript and summary from the user).
      try {
        const { indexMeetingContext } = require('@/lib/rag');
        const indexedContext = indexMeetingContext(newMeeting);
        newMeeting.analysis.chunks = indexedContext.chunks;
        newMeeting.analysis.suggestedPrompts = indexedContext.suggestedPrompts;
      } catch (indexErr: any) {
        console.warn('[Upload API] RAG indexing failed (non-fatal):', indexErr?.message || indexErr);
      }

      await saveMeeting(newMeeting, user.userId);
      console.log(`Meeting analysis & RAG indexing completed: ${newMeeting.id}`);
      
      return NextResponse.json(newMeeting);
    } catch (innerError: any) {
      console.error('Processing failed for meeting:', innerError);
      newMeeting.status = 'failed';
      newMeeting.error = innerError.message || 'Error occurred during transcription or extraction.';
      await saveMeeting(newMeeting, user.userId);
      return NextResponse.json(newMeeting, { status: 500 });
    }
  } catch (error: any) {
    console.error('Upload handler error:', error);
    return NextResponse.json({ error: 'Failed to upload and process: ' + error.message }, { status: 500 });
  }
}

// Runs the extraction pipeline matching the detected content type. 'meeting'
// and 'general' share the same extractor — the difference between them is
// purely how the dashboard renders the result (general hides the
// meeting-specific Decisions/Action Items/Risks sections), not how it's
// extracted, since a generic Summary + Key Points is a safe default for any
// content that doesn't clearly fit a more specific category.
async function extractInsightsForType(transcript: string, contentType: ContentType): Promise<MeetingAnalysis> {
  switch (contentType) {
    case 'lecture':
      return extractLectureInsights(transcript);
    case 'coding':
      return extractCodingInsights(transcript);
    case 'podcast':
      return extractPodcastInsights(transcript);
    case 'meeting':
    case 'general':
    default:
      return extractMeetingInsights(transcript);
  }
}

