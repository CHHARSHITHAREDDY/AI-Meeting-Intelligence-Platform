import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/whisper';

// Transcribes a single short WAV chunk (already decoded + resampled to 16kHz
// mono PCM in the browser, since the client can reliably decode its own
// MediaRecorder output via the Web Audio API, whereas the server has no
// ffmpeg/webm decoder available). Used by the extension's "Computer Audio"
// capture path for tabs/recordings that don't expose live captions.
// Unauthenticated by design — mirrors the rest of the /api/live-meetings
// surface the extension talks to from arbitrary tabs.
export async function POST(request: NextRequest) {
  try {
    const arrayBuffer = await request.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength < 44) {
      return NextResponse.json({ text: '' });
    }

    const buffer = Buffer.from(arrayBuffer);
    const text = await transcribeAudio(buffer, 'chunk.wav');
    return NextResponse.json({ text: (text || '').trim() });
  } catch (error: any) {
    console.error('[Transcribe Chunk] failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to transcribe audio chunk' }, { status: 500 });
  }
}
