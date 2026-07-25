import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
// @ts-ignore
import { pipeline } from '@xenova/transformers';

let transcriber: any = null;

function getFFmpegExecutablePath(): string | null {
  try {
    const pkgPath = require('ffmpeg-static');
    if (pkgPath && typeof pkgPath === 'string' && fs.existsSync(pkgPath)) {
      return pkgPath;
    }
  } catch (e) {}

  const localBin = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
  if (fs.existsSync(localBin)) {
    return localBin;
  }

  return 'ffmpeg';
}

export async function transcribeAudio(audioInput: Buffer | Float32Array, fileName: string): Promise<string> {
  const ext = path.extname(fileName || 'file.mp4').toLowerCase();
  const cleanTitle = path.basename(fileName || 'recording', ext).replace(/[_-]/g, ' ');
  console.log(`[Whisper Pipeline] Processing File: "${fileName}" | Extension: ${ext} | Input Size: ${audioInput instanceof Buffer ? audioInput.length : audioInput.byteLength} bytes`);

  const tempDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const timestamp = Date.now();
  const tempInputPath = path.join(tempDir, `input_${timestamp}${ext || '.mp4'}`);
  const tempWavPath = path.join(tempDir, `audio_${timestamp}.wav`);

  let audioSamples: Float32Array | null = null;

  try {
    if (audioInput instanceof Float32Array) {
      audioSamples = audioInput;
    } else if (audioInput instanceof Buffer) {
      // Step 1: Save raw uploaded media buffer to disk
      fs.writeFileSync(tempInputPath, audioInput);

      // If the input is already a WAV file (extension chunk pipeline sends 16kHz mono WAV),
      // copy it directly to tempWavPath and skip FFmpeg entirely — no conversion needed.
      const isInputWav = audioInput.length >= 12 &&
        audioInput.toString('ascii', 0, 4) === 'RIFF' &&
        audioInput.toString('ascii', 8, 12) === 'WAVE';

      if (isInputWav) {
        fs.copyFileSync(tempInputPath, tempWavPath);
        console.log('[Whisper Pipeline] Input is already a WAV — skipped FFmpeg conversion.');
        audioSamples = parseWav(audioInput);
      } else {
        // Step 2: Extract audio track to 16kHz 16-bit mono PCM WAV using FFmpeg
        const ffmpegPath = getFFmpegExecutablePath();
        if (ffmpegPath) {
          try {
            console.log(`[FFmpeg Pipeline] Converting media to 16kHz 16-bit mono PCM WAV using binary: ${ffmpegPath}...`);
            const ffmpegCmd = `"${ffmpegPath}" -y -i "${tempInputPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${tempWavPath}"`;
            execSync(ffmpegCmd, {
              stdio: ['ignore', 'ignore', 'pipe'],
              timeout: 180000,
            });

            if (fs.existsSync(tempWavPath) && fs.statSync(tempWavPath).size > 44) {
              console.log('[FFmpeg Pipeline] WAV file created successfully. Extracting PCM audio samples...');
              const wavBuffer = fs.readFileSync(tempWavPath);
              audioSamples = parseWav(wavBuffer);
            }
          } catch (ffmpegErr: any) {
            console.warn('[FFmpeg Pipeline] FFmpeg conversion warning:', ffmpegErr.message);
          }
        }

        // Step 3: Direct WAV input handling if FFmpeg was skipped
        if (!audioSamples) {
          if (isInputWav) {
            console.log('[Whisper Pipeline] Direct WAV file detected. Parsing PCM samples...');
            audioSamples = parseWav(audioInput);
          }
        }
      }
    }

    // Step 4a: Groq / OpenAI Whisper API call if key is available
    const groqApiKey = process.env.GROQ_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if ((groqApiKey && groqApiKey.trim() !== '') || (openaiApiKey && openaiApiKey !== 'YOUR_OPENAI_API_KEY' && openaiApiKey.trim() !== '')) {
      if (fs.existsSync(tempWavPath)) {
        try {
          const isGroq = groqApiKey && groqApiKey.trim() !== '';
          const apiKey = isGroq ? groqApiKey : openaiApiKey;
          const apiEndpoint = isGroq
            ? 'https://api.groq.com/openai/v1/audio/transcriptions'
            : 'https://api.openai.com/v1/audio/transcriptions';
          const modelName = isGroq ? 'whisper-large-v3-turbo' : 'whisper-1';

          console.log(`[Whisper API] Sending WAV to ${isGroq ? 'Groq' : 'OpenAI'} Whisper API (${modelName})...`);
          const wavBuffer = fs.readFileSync(tempWavPath);
          const formData = new FormData();
          const blob = new Blob([new Uint8Array(wavBuffer)], { type: 'audio/wav' });
          formData.append('file', blob, 'meeting_audio.wav');
          formData.append('model', modelName);
          formData.append('response_format', 'text');

          const res = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: formData,
          });

          if (res.ok) {
            const rawText = await res.text();
            if (rawText && rawText.trim().length > 0) {
              console.log(`[Whisper API] ${isGroq ? 'Groq' : 'OpenAI'} Whisper transcription completed successfully!`);
              return formatWhisperTranscript(rawText);
            }
          } else {
            console.warn(`[Whisper API] API error ${res.status}:`, await res.text());
          }
        } catch (apiErr: any) {
          console.warn('[Whisper API] Cloud Whisper API call failed:', apiErr.message);
        }
      }
    }

    // Step 4b: NVIDIA Parakeet-CTC ASR via NVIDIA NIM (uses existing NVIDIA_API_KEY)
    const nvidiaApiKey = process.env.NVIDIA_API_KEY;
    if (nvidiaApiKey && nvidiaApiKey.trim() !== '') {
      // Use the WAV file on disk, or fall back to the original input buffer
      const wavSource = fs.existsSync(tempWavPath) ? tempWavPath : tempInputPath;
      if (fs.existsSync(wavSource)) {
        try {
          console.log('[NVIDIA ASR] Sending WAV to NVIDIA Parakeet-CTC ASR...');
          const wavBuf = fs.readFileSync(wavSource);
          const formData = new FormData();
          const blob = new Blob([new Uint8Array(wavBuf)], { type: 'audio/wav' });
          formData.append('audio', blob, 'audio.wav');
          formData.append('model', 'nvidia/parakeet-ctc-1.1b');
          formData.append('response_format', 'text');

          const res = await fetch('https://ai.api.nvidia.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${nvidiaApiKey}` },
            body: formData,
          });

          if (res.ok) {
            const rawText = await res.text();
            if (rawText && rawText.trim().length > 0) {
              console.log('[NVIDIA ASR] Parakeet-CTC transcription completed!');
              return rawText.trim();
            }
          } else {
            const errText = await res.text();
            console.warn(`[NVIDIA ASR] API error ${res.status}:`, errText);
          }
        } catch (nvidiaErr: any) {
          console.warn('[NVIDIA ASR] NVIDIA Parakeet ASR call failed:', nvidiaErr.message);
        }
      }
    }

    // Step 5: ONNX Local Whisper Speech Recognition on extracted PCM samples
    if (audioSamples && audioSamples.length > 0) {
      try {
        if (!transcriber) {
          console.log('[Local Whisper] Initializing ONNX Whisper-base.en model...');
          transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base.en');
          console.log('[Local Whisper] Model loaded successfully.');
        }

        console.log('[Local Whisper] Transcribing speech from audio PCM samples...');
        const result = await transcriber(audioSamples, {
          chunk_length_s: 30,
          stride_length_s: 5,
        });

        if (result && result.text && result.text.trim().length > 0) {
          console.log('[Local Whisper] Transcribed speech successfully!');
          return formatWhisperTranscript(result.text);
        }
      } catch (whisperErr: any) {
        console.error('[Local Whisper] Local speech recognition error:', whisperErr.message);
      }
    }

    // No usable audio could be extracted (ffmpeg conversion failed/timed out,
    // or the local Whisper model produced no text). Fail loudly instead of
    // returning a canned placeholder transcript — a fabricated transcript
    // would silently flow into extractMeetingInsights() and produce a
    // "summary" that has nothing to do with the actual recording.
    throw new Error(
      audioSamples
        ? 'Local Whisper produced no speech text for this recording (audio may be silent, too short, or unsupported).'
        : 'Could not extract audio from this file — ffmpeg conversion failed or timed out. Try a shorter clip or a standard format (mp3/wav/mp4).'
    );

  } finally {
    // Cleanup temporary files on disk
    try {
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
    } catch (cleanupErr) {
      console.warn('[Cleanup] Error deleting temp files:', cleanupErr);
    }
  }
}

// Format raw Whisper speech output into timestamped dialogue lines [MM:SS] Speaker X: Text
function formatWhisperTranscript(rawText: string): string {
  let sentences = rawText
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (sentences.length <= 1 && rawText.length > 80) {
    // Fallback: split long text without punctuation by clauses or word counts
    const words = rawText.trim().split(/\s+/);
    sentences = [];
    for (let i = 0; i < words.length; i += 15) {
      sentences.push(words.slice(i, i + 15).join(' '));
    }
  }

  if (sentences.length === 0) return rawText;

  const formattedLines: string[] = [];
  let currentSeconds = 5;

  sentences.forEach((sentence, idx) => {
    const timeStr = formatTimestamp(currentSeconds);
    const speakerName = `Speaker ${(idx % 2) + 1}`;

    formattedLines.push(`[${timeStr}] ${speakerName}: ${sentence}`);
    currentSeconds += Math.max(8, Math.floor(sentence.split(' ').length * 0.45));
  });

  return formattedLines.join('\n');
}

function formatTimestamp(secondsNum: number): string {
  const mins = Math.floor(secondsNum / 60);
  const secs = Math.floor(secondsNum % 60);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function parseWav(buffer: Buffer): Float32Array {
  if (buffer.length < 44) throw new Error("Invalid WAV buffer: size too small");

  let numChannels = 1;
  let sampleRate = 16000;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  let offset = 12;
  while (offset < buffer.length - 8) {
    const subchunkId = buffer.toString('ascii', offset, offset + 4);
    const subchunkSize = buffer.readUInt32LE(offset + 4);

    if (subchunkId === 'fmt ') {
      numChannels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      bitsPerSample = buffer.readUInt16LE(offset + 22);
    } else if (subchunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = subchunkSize;
      break;
    }
    offset += 8 + subchunkSize;
  }

  if (dataOffset === -1 || dataOffset >= buffer.length) {
    dataOffset = 44;
    dataSize = buffer.length - 44;
  }

  const dataBuffer = buffer.subarray(dataOffset, dataOffset + dataSize);
  const int16Count = Math.floor(dataBuffer.length / 2);
  const samples = new Float32Array(int16Count);

  for (let i = 0; i < int16Count; i++) {
    samples[i] = dataBuffer.readInt16LE(i * 2) / 32768;
  }

  if (numChannels > 1) {
    const monoLength = Math.floor(samples.length / numChannels);
    const monoSamples = new Float32Array(monoLength);
    for (let i = 0; i < monoLength; i++) {
      let sum = 0;
      for (let c = 0; c < numChannels; c++) {
        sum += samples[i * numChannels + c];
      }
      monoSamples[i] = sum / numChannels;
    }
    return monoSamples;
  }

  return samples;
}
