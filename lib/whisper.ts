import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
// @ts-ignore
import { pipeline } from '@xenova/transformers';

export type TranscriptionLanguage = 'en' | 'hi' | 'te' | 'auto';

const SUPPORTED_LANGUAGES: TranscriptionLanguage[] = ['en', 'hi', 'te', 'auto'];

const LOCAL_WHISPER_LANGUAGE_NAMES: Record<'en' | 'hi' | 'te', string> = {
  en: 'english',
  hi: 'hindi',
  te: 'telugu',
};

function assertSupportedLanguage(language: TranscriptionLanguage | undefined): void {
  if (language !== undefined && !SUPPORTED_LANGUAGES.includes(language)) {
    throw new Error(`Unsupported language "${language}" — expected one of: en, hi, te, auto.`);
  }
}

export interface TranscriptionResult {
  text: string;
  detectedLanguage?: string;
}

let transcriber: any = null;
const WHISPER_MODEL_NAME = process.env.WHISPER_MODEL || 'Xenova/whisper-small';

export async function initWhisperModel(): Promise<any> {
  if (!transcriber) {
    console.log(`[Local Whisper] Pre-warming ONNX Multilingual Model (${WHISPER_MODEL_NAME}) into memory...`);
    const startTime = performance.now();
    transcriber = await pipeline('automatic-speech-recognition', WHISPER_MODEL_NAME);
    console.log(`[Local Whisper] Multilingual Model (${WHISPER_MODEL_NAME}) loaded and resident in memory (${(performance.now() - startTime).toFixed(2)} ms).`);
  }
  return transcriber;
}

if (typeof window === 'undefined') {
  setTimeout(() => {
    initWhisperModel().catch((err) => {
      console.warn('[Local Whisper] Background pre-warm notice:', err?.message || err);
    });
  }, 1000);
}

function getFFmpegExecutablePath(): string | null {
  try {
    const pkgPath = require('ffmpeg-static');
    if (pkgPath && typeof pkgPath === 'string' && fs.existsSync(pkgPath)) {
      return pkgPath;
    }
  } catch (e) { }

  const localBin = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
  if (fs.existsSync(localBin)) {
    return localBin;
  }

  return 'ffmpeg';
}

export async function transcribeAudio(
  audioInput: Buffer | Float32Array,
  fileName: string,
  language: TranscriptionLanguage = 'auto'
): Promise<TranscriptionResult> {
  assertSupportedLanguage(language);

  const tStartTotal = performance.now();
  const ext = path.extname(fileName || 'file.mp4').toLowerCase();
  console.log(`\n=========================================================`);
  console.log(`[Whisper Pipeline] AUDIT START`);
  console.log(`- File Name: "${fileName}"`);
  console.log(`- Loaded Model: ${WHISPER_MODEL_NAME}`);
  console.log(`- Requested Language: ${language}`);
  console.log(`- Audio Buffer Size: ${audioInput instanceof Buffer ? audioInput.length : audioInput.byteLength} bytes`);
  console.log(`=========================================================\n`);

  const tempDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const timestamp = Date.now();
  const tempInputPath = path.join(tempDir, `input_${timestamp}${ext || '.mp4'}`);
  const tempWavPath = path.join(tempDir, `audio_${timestamp}.wav`);

  let audioSamples: Float32Array | null = null;
  const tAudioStart = performance.now();

  try {
    if (audioInput instanceof Float32Array) {
      audioSamples = audioInput;
    } else if (audioInput instanceof Buffer) {
      // Direct in-memory WAV check
      const isWav = audioInput.length >= 44 && audioInput.toString('ascii', 0, 4) === 'RIFF' && audioInput.toString('ascii', 8, 12) === 'WAVE';
      if (isWav) {
        try {
          console.log('[Whisper Pipeline] Direct WAV detected in-memory. Extracting PCM samples instantly...');
          audioSamples = parseWav(audioInput);
        } catch (wavErr: any) {
          console.warn('[Whisper Pipeline] Direct WAV parse notice, falling back to FFmpeg:', wavErr?.message || wavErr);
        }
      }

      if (!audioSamples) {
        fs.writeFileSync(tempInputPath, audioInput);

        const ffmpegPath = getFFmpegExecutablePath();
        if (ffmpegPath) {
          try {
            console.log(`[FFmpeg Pipeline] Fast converting media to 16kHz PCM WAV using binary: ${ffmpegPath}...`);
            const ffmpegCmd = `"${ffmpegPath}" -y -i "${tempInputPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 -threads 0 -preset ultrafast "${tempWavPath}"`;
            execSync(ffmpegCmd, {
              stdio: ['ignore', 'ignore', 'pipe'],
              timeout: 180000,
            });

            if (fs.existsSync(tempWavPath) && fs.statSync(tempWavPath).size > 44) {
              const wavBuffer = fs.readFileSync(tempWavPath);
              audioSamples = parseWav(wavBuffer);
            }
          } catch (ffmpegErr: any) {
            console.warn('[FFmpeg Pipeline] FFmpeg conversion warning:', ffmpegErr.message);
          }
        }
      }
    }

    const audioDurationMs = (performance.now() - tAudioStart).toFixed(2);
    console.log(`[PERF PROFILE] Stage: Audio Extraction / Decoding | Duration: ${audioDurationMs} ms`);

    // Cloud Whisper API call if key is available
    const groqApiKey = process.env.GROQ_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if ((groqApiKey && groqApiKey.trim() !== '') || (openaiApiKey && openaiApiKey !== 'YOUR_OPENAI_API_KEY' && openaiApiKey.trim() !== '')) {
      const tCloudStart = performance.now();
      let wavBufferForApi: Buffer | null = null;

      if (fs.existsSync(tempWavPath)) {
        wavBufferForApi = fs.readFileSync(tempWavPath);
      } else if (audioInput instanceof Buffer && audioInput.length >= 44 && audioInput.toString('ascii', 0, 4) === 'RIFF') {
        wavBufferForApi = audioInput;
      }

      if (wavBufferForApi) {
        try {
          const isGroq = groqApiKey && groqApiKey.trim() !== '';
          const apiKey = isGroq ? groqApiKey : openaiApiKey;
          const apiEndpoint = isGroq
            ? 'https://api.groq.com/openai/v1/audio/transcriptions'
            : 'https://api.openai.com/v1/audio/transcriptions';
          const modelName = isGroq ? 'whisper-large-v3-turbo' : 'whisper-1';

          console.log(`[Whisper API] Sending WAV to ${isGroq ? 'Groq' : 'OpenAI'} Whisper API (${modelName}, lang=${language})...`);
          const formData = new FormData();
          const blob = new Blob([new Uint8Array(wavBufferForApi)], { type: 'audio/wav' });
          formData.append('file', blob, 'meeting_audio.wav');
          formData.append('model', modelName);
          formData.append('response_format', 'verbose_json');

          if (language && language !== 'auto') {
            formData.append('language', language);
          }

          const res = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            const rawText = data.text || '';
            const detectedLang = data.language || (language !== 'auto' ? language : undefined);

            if (rawText && rawText.trim().length > 0) {
              console.log(`[Whisper API Raw Output] "${rawText.slice(0, 150)}..."`);
              console.log(`[Whisper API] ${isGroq ? 'Groq' : 'OpenAI'} transcription completed! (Detected: ${detectedLang})`);
              return {
                text: formatWhisperTranscript(rawText),
                detectedLanguage: detectedLang,
              };
            }
          } else {
            console.warn(`[Whisper API] API error ${res.status}:`, await res.text());
          }
        } catch (apiErr: any) {
          console.warn('[Whisper API] Cloud Whisper API call failed:', apiErr.message);
        }
      }
    }

    // ONNX Multilingual Whisper Speech Recognition on extracted PCM samples
    if (audioSamples && audioSamples.length > 0) {
      const tInferenceStart = performance.now();
      try {
        await initWhisperModel();

        const generate_kwargs: any = {
          task: 'transcribe',
          repetition_penalty: 1.2,
          no_repeat_ngram_size: 3,
        };

        if (language && language !== 'auto' && LOCAL_WHISPER_LANGUAGE_NAMES[language]) {
          generate_kwargs.language = LOCAL_WHISPER_LANGUAGE_NAMES[language];
        }

        console.log(`[Local Whisper] Running ONNX inference (${WHISPER_MODEL_NAME})...`);
        console.log(`[Local Whisper] Options passed to generate_kwargs:`, JSON.stringify(generate_kwargs));

        const result = await transcriber(audioSamples, {
          chunk_length_s: 30,
          stride_length_s: 5,
          generate_kwargs,
        });

        const rawText = result && result.text ? result.text : '';
        const detectedLang = result?.language || (language !== 'auto' ? language : undefined);

        console.log(`[Local Whisper Raw Transcription]: "${rawText.slice(0, 200)}"`);
        console.log(`[Local Whisper Detected Language]: "${detectedLang}"`);

        if (rawText && rawText.trim().length > 0) {
          const formattedText = formatWhisperTranscript(rawText);
          console.log(`[PERF PROFILE] Stage: ONNX Multilingual Whisper Inference | Duration: ${(performance.now() - tInferenceStart).toFixed(2)} ms`);
          console.log(`[PERF PROFILE] Total Whisper Pipeline Duration: ${(performance.now() - tStartTotal).toFixed(2)} ms`);
          
          return {
            text: formattedText,
            detectedLanguage: detectedLang,
          };
        }
      } catch (whisperErr: any) {
        console.error('[Local Whisper] Speech recognition error:', whisperErr.message);
      }
    }

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

// Clean and deduplicate hallucinated token loops in raw Whisper output before returning
function sanitizeWhisperRawText(rawText: string): string {
  let cleaned = rawText.trim();

  // Deduplicate consecutive identical words / tokens (e.g. "హాన్ హాన్ హాన్")
  cleaned = cleaned.replace(/(\b[\u0C00-\u0C7F\w]+\b)(?:\s+\1){3,}/gu, '$1');

  // Strip hallucinated Urdu / Arabic script blocks if audio was transcribed as non-Arabic
  cleaned = cleaned.replace(/[\u0600-\u06FF]+/g, '').trim();

  return cleaned;
}

// Format raw Whisper speech output into timestamped dialogue lines [MM:SS] Speaker X: Text
function formatWhisperTranscript(rawText: string): string {
  const sanitized = sanitizeWhisperRawText(rawText);

  let sentences = sanitized
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (sentences.length <= 1 && sanitized.length > 80) {
    const words = sanitized.trim().split(/\s+/);
    sentences = [];
    for (let i = 0; i < words.length; i += 15) {
      sentences.push(words.slice(i, i + 15).join(' '));
    }
  }

  if (sentences.length === 0) return sanitized;

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
