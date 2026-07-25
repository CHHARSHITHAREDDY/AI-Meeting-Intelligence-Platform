// @ts-ignore
import { YoutubeTranscript } from 'youtube-transcript';
import { transcribeAudio, TranscriptionLanguage, TranscriptionResult } from './whisper';

export function getYoutubeVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export async function fetchYoutubeTitle(videoId: string): Promise<string> {
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

export interface YoutubeTranscriptionResult {
  transcript: string;
  languageUsed: string;
  detectedLanguage?: string;
  source: 'captions' | 'whisper-fallback';
}

export async function transcribeYoutube(
  videoId: string,
  language: TranscriptionLanguage = 'auto'
): Promise<YoutubeTranscriptionResult> {
  // Step 1: Try fetching YouTube captions track directly
  try {
    const config = language && language !== 'auto' ? { lang: language } : undefined;
    console.log(`[YouTube Pipeline] Fetching captions for video ${videoId} (lang=${language || 'default'})...`);
    const segments = await YoutubeTranscript.fetchTranscript(videoId, config);

    if (segments && segments.length > 0) {
      const rawText = segments.map((s: any) => s.text).join(' ');
      console.log(`[YouTube Pipeline] Successfully fetched caption track (${segments.length} segments).`);
      return {
        transcript: rawText,
        languageUsed: language !== 'auto' ? language : 'auto',
        source: 'captions',
      };
    }
  } catch (captionErr: any) {
    console.warn(`[YouTube Pipeline] Caption fetch failed (${captionErr?.message || captionErr}). Falling back to media stream audio transcription...`);
  }

  // Step 2: Fall back to fetching YouTube audio stream and running through Whisper
  try {
    const mediaStreamUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`[YouTube Pipeline] Downloading audio from media link ${mediaStreamUrl}...`);
    const fileRes = await fetch(mediaStreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      }
    });

    if (fileRes.ok) {
      const arrayBuffer = await fileRes.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);
      const whisperResult = await transcribeAudio(audioBuffer, `youtube_${videoId}.mp4`, language);
      return {
        transcript: whisperResult.text,
        languageUsed: language,
        detectedLanguage: whisperResult.detectedLanguage,
        source: 'whisper-fallback',
      };
    }
  } catch (fallbackErr: any) {
    console.error(`[YouTube Pipeline] Audio transcription fallback failed:`, fallbackErr?.message || fallbackErr);
  }

  throw new Error(`Could not fetch captions or transcribe YouTube video (${videoId}). Verify the video URL is public.`);
}
