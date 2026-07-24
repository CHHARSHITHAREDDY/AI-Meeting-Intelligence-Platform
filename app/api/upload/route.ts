import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/whisper';
import { extractMeetingInsights } from '@/lib/extract';
import { saveMeeting, Meeting } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const title = (formData.get('title') as string) || file.name.replace(/\.[^/.]+$/, "");
    const id = Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
    
    // Save initial processing state
    const newMeeting: Meeting = {
      id,
      title,
      date: new Date().toISOString(),
      duration: 'Processing...',
      transcript: '',
      status: 'processing',
    };
    
    await saveMeeting(newMeeting);

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      console.log(`Transcribing audio file: ${file.name}...`);
      const transcript = await transcribeAudio(buffer, file.name);
      
      console.log('Extracting insights with Claude...');
      const insights = await extractMeetingInsights(transcript);
      
      // Calculate a dummy duration based on word count (e.g. average 130 words per minute)
      const wordCount = transcript.split(/\s+/).length;
      const minutes = Math.floor(wordCount / 130) || 1;
      const seconds = Math.floor((wordCount % 130) * 0.46) % 60;
      const durationStr = `${minutes}m ${seconds}s`;

      newMeeting.transcript = transcript;
      newMeeting.analysis = insights;
      newMeeting.duration = durationStr;
      newMeeting.status = 'completed';
      
      await saveMeeting(newMeeting);
      console.log(`Meeting analysis completed: ${newMeeting.id}`);
      
      return NextResponse.json(newMeeting);
    } catch (innerError: any) {
      console.error('Processing failed for meeting:', innerError);
      newMeeting.status = 'failed';
      newMeeting.error = innerError.message || 'Error occurred during transcription or extraction.';
      await saveMeeting(newMeeting);
      return NextResponse.json(newMeeting, { status: 500 });
    }
  } catch (error) {
    console.error('Upload handler error:', error);
    return NextResponse.json({ error: 'Failed to upload and process meeting' }, { status: 500 });
  }
}
