import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio, TranscriptionLanguage } from '@/lib/whisper';
import { transcribeYoutube, getYoutubeVideoId, fetchYoutubeTitle } from '@/lib/youtube';
import { extractMeetingInsights, extractLectureInsights, extractCodingInsights, extractPodcastInsights } from '@/lib/extract';
import { classifyContentType, ContentType } from '@/lib/classify';
import { saveMeeting, getMeetingById, getProjectById, updateProjectIntelligence, Meeting, MeetingAnalysis } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

function parseRawMultipart(buffer: Buffer, contentTypeHeader: string): {
  fileBuffer: Buffer | null;
  fileName: string;
  title: string;
  link: string;
  projectId: string;
  meetingId: string;
  language: TranscriptionLanguage;
} {
  let fileBuffer: Buffer | null = null;
  let fileName = '';
  let title = '';
  let link = '';
  let projectId = '';
  let meetingId = '';
  let language: TranscriptionLanguage = 'auto';

  const boundaryMatch = contentTypeHeader.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return { fileBuffer, fileName, title, link, projectId, meetingId, language };

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
      } else if (fieldName === 'projectId') {
        projectId = bodyBuffer.toString('utf-8').trim();
      } else if (fieldName === 'meetingId') {
        meetingId = bodyBuffer.toString('utf-8').trim();
      } else if (fieldName === 'language') {
        language = (bodyBuffer.toString('utf-8').trim() as TranscriptionLanguage) || 'auto';
      }
    }
  }

  return { fileBuffer, fileName, title, link, projectId, meetingId, language };
}

export async function POST(request: NextRequest) {
  const tTotalStart = performance.now();
  const timings: Record<string, number> = {};

  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tParseStart = performance.now();
    const contentType = request.headers.get('content-type') || '';
    let title = '';
    let audioInput: Buffer | Float32Array | null = null;
    let fileName = '';
    let transcript = '';
    let isLinkTranscribed = false;
    let projectId = '';
    let meetingId = '';
    let language: TranscriptionLanguage = 'auto';
    let detectedLanguage: string | undefined = undefined;

    if (contentType.includes('application/octet-stream')) {
      const url = new URL(request.url);
      title = url.searchParams.get('title') || 'Local Recording';
      projectId = url.searchParams.get('projectId') || '';
      meetingId = url.searchParams.get('meetingId') || '';
      language = (url.searchParams.get('language') as TranscriptionLanguage) || 'auto';
      fileName = 'audio.pcm';
      const arrayBuffer = await request.arrayBuffer();
      audioInput = new Float32Array(arrayBuffer);
    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      title = body.title || '';
      projectId = body.projectId || '';
      meetingId = body.meetingId || '';
      language = (body.language as TranscriptionLanguage) || 'auto';
      const link = body.link || '';
      if (link && link.trim() !== '') {
        const videoId = getYoutubeVideoId(link.trim());
        if (videoId) {
          console.log('[Upload API] YouTube URL detected:', videoId, 'lang:', language);
          if (!title) {
            title = await fetchYoutubeTitle(videoId);
          }
          const ytResult = await transcribeYoutube(videoId, language);
          transcript = ytResult.transcript;
          detectedLanguage = ytResult.detectedLanguage;
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
        projectId = (formData.get('projectId') as string) || '';
        meetingId = (formData.get('meetingId') as string) || '';
        language = ((formData.get('language') as string) as TranscriptionLanguage) || 'auto';
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
          if (parsed.projectId) projectId = parsed.projectId;
          if (parsed.meetingId) meetingId = parsed.meetingId;
          if (parsed.language) language = parsed.language;
        } catch (rawErr: any) {
          console.error('[Upload API] Raw multipart parse error:', rawErr);
        }
      }

      if (!audioInput && link && link.trim() !== '') {
        const videoId = getYoutubeVideoId(link.trim());
        if (videoId) {
          console.log('[Upload API] YouTube URL detected:', videoId, 'lang:', language);
          if (!title) {
            title = await fetchYoutubeTitle(videoId);
          }
          const ytResult = await transcribeYoutube(videoId, language);
          transcript = ytResult.transcript;
          detectedLanguage = ytResult.detectedLanguage;
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

    timings['Upload Receive & Parse'] = performance.now() - tParseStart;

    let scheduledMeeting: Meeting | null = null;
    if (meetingId) {
      const existing = await getMeetingById(meetingId, user.userId);
      if (existing && existing.status === 'scheduled') {
        scheduledMeeting = existing;
      }
    }

    const id = scheduledMeeting?.id || (Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7));

    const newMeeting: Meeting = scheduledMeeting
      ? {
          ...scheduledMeeting,
          title: title || scheduledMeeting.title,
          duration: 'Processing...',
          transcript: '',
          status: 'processing',
          projectId: projectId || scheduledMeeting.projectId,
          language,
          detectedLanguage,
        }
      : {
          id,
          title: title || 'Web Link Analysis',
          date: new Date().toISOString(),
          duration: 'Processing...',
          transcript: '',
          status: 'processing',
          projectId: projectId || undefined,
          language,
          detectedLanguage,
        };

    const tInitialDbStart = performance.now();
    await saveMeeting(newMeeting, user.userId);
    timings['Initial Processing DB Persist'] = performance.now() - tInitialDbStart;

    try {
      if (!isLinkTranscribed && audioInput) {
        const tWhisperStart = performance.now();
        console.log(`Transcribing audio file: ${fileName} (lang=${language})...`);
        const result = await transcribeAudio(audioInput, fileName, language);
        transcript = result.text;
        detectedLanguage = result.detectedLanguage;
        timings['Audio & Whisper Pipeline'] = performance.now() - tWhisperStart;
      }
      
      const tAiStart = performance.now();
      console.log('Running concurrent Content Classification & AI Insight Extraction...');
      
      // Parallelize classification and default meeting insight extraction
      const [classification, defaultMeetingInsights] = await Promise.all([
        classifyContentType(transcript),
        extractMeetingInsights(transcript)
      ]);

      console.log(`[Upload API] Detected content type: ${classification.contentType} (${classification.confidence}% confidence)`);

      let insights: MeetingAnalysis;
      if (classification.contentType === 'meeting' || classification.contentType === 'general') {
        insights = defaultMeetingInsights;
      } else {
        console.log(`Extracting specific ${classification.contentType} insights...`);
        insights = await extractInsightsForType(transcript, classification.contentType);
      }

      insights.contentType = classification.contentType;
      insights.contentTypeConfidence = classification.confidence;
      timings['AI Insights & Classification'] = performance.now() - tAiStart;

      const wordCount = transcript.split(/\s+/).length;
      const minutes = Math.floor(wordCount / 130) || 1;
      const seconds = Math.floor((wordCount % 130) * 0.46) % 60;
      const durationStr = `${minutes}m ${seconds}s`;

      newMeeting.transcript = transcript;
      newMeeting.analysis = insights;
      newMeeting.duration = durationStr;
      newMeeting.status = 'completed';
      newMeeting.language = language;
      newMeeting.detectedLanguage = detectedLanguage;

      const tRagStart = performance.now();
      try {
        const { indexMeetingContext } = require('@/lib/rag');
        const indexedContext = indexMeetingContext(newMeeting);
        newMeeting.analysis.chunks = indexedContext.chunks;
        newMeeting.analysis.suggestedPrompts = indexedContext.suggestedPrompts;
      } catch (indexErr: any) {
        console.warn('[Upload API] RAG indexing failed (non-fatal):', indexErr?.message || indexErr);
      }
      timings['RAG Indexing'] = performance.now() - tRagStart;

      const tFinalDbStart = performance.now();
      await saveMeeting(newMeeting, user.userId);
      timings['Final DB Persist'] = performance.now() - tFinalDbStart;

      const totalMs = performance.now() - tTotalStart;
      timings['Total End-to-End Latency'] = totalMs;

      console.log('\n=========================================================');
      console.log('         PERFORMANCE PROFILING LATENCY REPORT            ');
      console.log('=========================================================');
      Object.entries(timings).forEach(([stage, dur]) => {
        console.log(`- ${stage.padEnd(35)}: ${dur.toFixed(2)} ms`);
      });
      console.log('=========================================================\n');

      if (newMeeting.projectId) {
        refreshProjectIntelligence(newMeeting.projectId, user.userId).catch((err) => {
          console.warn('[Upload API] Background project intelligence refresh warning:', err?.message || err);
        });
      }
      
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

async function refreshProjectIntelligence(projectId: string, userId: string): Promise<void> {
  const { extractProjectSynthesis } = require('@/lib/extract');
  const { getMeetingsByProject } = require('@/lib/db');

  const project = await getProjectById(projectId, userId);
  if (!project) return;

  const projectMeetings = await getMeetingsByProject(projectId, userId);
  const completedMeetings = projectMeetings.filter((m: Meeting) => m.status === 'completed');

  if (completedMeetings.length === 0) return;

  const synthesis = await extractProjectSynthesis(
    project.name,
    project.description || '',
    completedMeetings
  );

  await updateProjectIntelligence(projectId, synthesis);
}

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
