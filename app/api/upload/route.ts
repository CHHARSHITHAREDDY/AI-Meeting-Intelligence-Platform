import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/whisper';
import { extractMeetingInsights } from '@/lib/extract';
import { saveMeeting, Meeting } from '@/lib/db';
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
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch (err: any) {
        console.error('[Upload API] FormData parse error:', err);
        return NextResponse.json({ error: 'Failed to parse form upload data. Please select a valid audio/video file.' }, { status: 400 });
      }

      const file = formData.get('file') as File | null;
      const link = formData.get('link') as string | null;
      title = (formData.get('title') as string) || '';

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
      } else if (file) {
        title = title || file.name.replace(/\.[^/.]+$/, "");
        fileName = file.name;
        const arrayBuffer = await file.arrayBuffer();
        audioInput = Buffer.from(arrayBuffer);
      } else {
        return NextResponse.json({ error: 'No file or link provided' }, { status: 400 });
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
      
      console.log('Extracting insights with LlamaCloud...');
      const insights = await extractMeetingInsights(transcript);
      
      // Calculate duration based on word count
      const wordCount = transcript.split(/\s+/).length;
      const minutes = Math.floor(wordCount / 130) || 1;
      const seconds = Math.floor((wordCount % 130) * 0.46) % 60;
      const durationStr = `${minutes}m ${seconds}s`;

      newMeeting.transcript = transcript;
      newMeeting.analysis = insights;
      newMeeting.duration = durationStr;
      newMeeting.status = 'completed';

      // Index meeting context for RAG Vector Pipeline
      const { indexMeetingContext } = require('@/lib/rag');
      const indexedContext = indexMeetingContext(newMeeting);
      newMeeting.analysis.chunks = indexedContext.chunks;
      newMeeting.analysis.suggestedPrompts = indexedContext.suggestedPrompts;
      
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

