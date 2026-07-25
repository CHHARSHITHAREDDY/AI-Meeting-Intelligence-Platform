import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio, TranscriptionLanguage } from '@/lib/whisper';

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const language = (url.searchParams.get('language') as TranscriptionLanguage) || 'auto';

    const arrayBuffer = await request.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength < 44) {
      return NextResponse.json({ text: '' });
    }

    const buffer = Buffer.from(arrayBuffer);
    const result = await transcribeAudio(buffer, 'chunk.wav', language);
    return NextResponse.json({ text: (result.text || '').trim(), detectedLanguage: result.detectedLanguage });
  } catch (error: any) {
    console.error('[Transcribe Chunk] failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to transcribe audio chunk' }, { status: 500 });
  }
}
