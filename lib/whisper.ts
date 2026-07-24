import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

export async function transcribeAudio(audioBuffer: Buffer, fileName: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'YOUR_OPENAI_API_KEY' || apiKey.trim() === '') {
    console.log('OpenAI API key missing or default. Running Whisper in Mock Mode...');
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    // Return a realistic transcript for testing
    return `[00:05] Alex (Engineering Lead): Hi team, let's discuss our infrastructure scaling roadmap for Q4. The key issue is our database CPU usage peaking at 90% during peak hours.
[00:35] Sarah (Product Manager): Thanks Alex. What is causing this CPU peak? Is it read-heavy query load or lack of indexing?
[00:55] Alex (Engineering Lead): Mainly read-heavy queries on our analytics table. We need to implement database replication and offload reporting queries to a read-replica.
[01:15] Sarah (Product Manager): Okay, let's make that a formal decision. We will set up a read-replica for reporting by October 15th. Alex, you'll own this task.
[01:35] Sarah (Product Manager): Also, what about security auditing? We had an action item to review IAM roles.
[01:50] Michael (Security Specialist): Yes, I've started the review. I will finish auditing IAM roles and clean up unused user access tokens by end of next week. We should also move to short-lived session tokens to mitigate credential leakage risks.
[02:15] Sarah (Product Manager): Moving to short-lived session tokens sounds like a solid security policy. Let's schedule the implementation of short-lived tokens for late October. Michael, please document the migration plan.
[02:40] Alex (Engineering Lead): I should point out a risk: read-replicas could introduce a 2-3 second sync lag. We must make sure the UI handles eventual consistency gracefully.
[03:00] Sarah (Product Manager): Good point, we need to alert the frontend team about eventual consistency. I'll ask David to sync with them. Thanks everyone!`;
  }

  const openai = new OpenAI({ apiKey });
  
  const tempDir = path.join(process.cwd(), 'data', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const filePath = path.join(tempDir, `${Date.now()}-${fileName}`);
  
  try {
    await fs.promises.writeFile(filePath, audioBuffer);
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
    });
    return response.text;
  } catch (error) {
    console.error('Whisper API Error:', error);
    throw error;
  } finally {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (e) {
      console.error('Failed to delete temp audio file:', e);
    }
  }
}
