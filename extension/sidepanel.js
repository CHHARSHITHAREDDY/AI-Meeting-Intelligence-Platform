let mediaRecorder = null;
let audioChunks = [];
let micStream = null;
let recognition = null;

let isListening = false;
let isPaused = false;
let secondsElapsed = 0;
let timerInterval = null;
let currentMeetingId = null;

let liveTranscriptLines = [];
let currentInsights = { summary: '', decisions: [], actionItems: [], risks: [] };
let activeFilter = 'all';
let lastFinalKey = '';

const BACKEND_URL = 'http://localhost:3000';

// DOM Elements
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const activeActions = document.getElementById('activeActions');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const timerDisplay = document.getElementById('timerDisplay');
const transcriptFeed = document.getElementById('transcriptFeed');
const livePulse = document.getElementById('livePulse');
const insightList = document.getElementById('insightList');
const audioSource = document.getElementById('audioSource');
const speakerNameInput = document.getElementById('speakerNameInput');
const manualInput = document.getElementById('manualInput');
const sendBtn = document.getElementById('sendBtn');
const chatTabBtn = document.getElementById('chatTabBtn');
const chatPanel = document.getElementById('chatPanel');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');

// ─── Backend Bridge (relayed through background.js — see extension/background.js) ───
function callApi(path, method, body) {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      resolve({ ok: false, error: 'chrome.runtime unavailable' });
      return;
    }
    try {
      chrome.runtime.sendMessage({ type: 'CUE_API', path, method, body }, (response) => {
        if (chrome.runtime.lastError) { resolve({ ok: false, error: chrome.runtime.lastError.message }); return; }
        resolve(response || { ok: false });
      });
    } catch (err) {
      resolve({ ok: false, error: err?.message || String(err) });
    }
  });
}

let apiQueue = Promise.resolve();
function enqueue(fn) {
  apiQueue = apiQueue.then(fn, fn);
  return apiQueue;
}

let meetingCreationPromise = null;
function ensureLiveMeeting() {
  if (currentMeetingId) return Promise.resolve(currentMeetingId);
  if (meetingCreationPromise) return meetingCreationPromise;

  meetingCreationPromise = callApi('/api/live-meetings', 'POST', {
    title: `Weave Sidepanel Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    hostName: (speakerNameInput?.value || 'You').trim() || 'You',
  }).then((res) => {
    if (res.ok && res.data && res.data.meeting) {
      currentMeetingId = res.data.meeting.id;
      callApi(`/api/live-meetings/${currentMeetingId}`, 'PATCH', { action: 'start' }).catch(() => {});
    }
    return currentMeetingId;
  }).catch(() => null);

  return meetingCreationPromise;
}

function pushTranscriptToBackend(speaker, text) {
  enqueue(async () => {
    const id = await ensureLiveMeeting();
    if (!id) return;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const res = await callApi(`/api/live-meetings/${id}`, 'POST', { text, speaker, timestamp });
    if (res.ok && res.data && res.data.meeting) {
      currentInsights = res.data.meeting.insights;
      renderInsights();
    }
  });
}

// Tab Filter Buttons
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const tab = e.currentTarget.getAttribute('data-tab') || 'all';
    if (tab === 'chat') {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      insightList.style.display = 'none';
      chatPanel.classList.add('active');
      return;
    }
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    insightList.style.display = 'flex';
    chatPanel.classList.remove('active');
    activeFilter = tab;
    renderInsights();
  });
});

// Format seconds into 00:00:00
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

function startTimer() {
  secondsElapsed = 0;
  timerDisplay.textContent = formatTime(secondsElapsed);
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!isPaused) {
      secondsElapsed++;
      timerDisplay.textContent = formatTime(secondsElapsed);
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

// Append transcript item to UI feed (deduped + timestamped)
function appendTranscriptUI(speaker, text, isInterim = false) {
  if (!text || !text.trim()) return;
  text = text.trim();
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const placeholder = transcriptFeed.querySelector('.placeholder-info');
  if (placeholder) placeholder.remove();

  let interimEl = transcriptFeed.querySelector('.interim-line');
  if (isInterim) {
    if (!interimEl) {
      interimEl = document.createElement('div');
      interimEl.className = 'transcript-line interim-line';
      interimEl.style.opacity = '0.7';
      interimEl.style.fontStyle = 'italic';
      interimEl.style.color = '#a5b4fc';
      transcriptFeed.appendChild(interimEl);
    }
    interimEl.innerHTML = `
      <span class="timestamp">${timeStr}</span>
      <span class="speaker-tag">${speaker} (speaking...):</span>
      <span>${text}</span>
    `;
    transcriptFeed.scrollTop = transcriptFeed.scrollHeight;
    return;
  }

  if (interimEl) interimEl.remove();

  // Prevent duplicate transcript entries
  const dedupeKey = `${speaker}::${text.toLowerCase()}`;
  if (dedupeKey === lastFinalKey) return;
  lastFinalKey = dedupeKey;

  const el = document.createElement('div');
  el.className = 'transcript-line';
  el.innerHTML = `
    <span class="timestamp">${timeStr}</span>
    <span class="speaker-tag">${speaker}:</span>
    <span>${text}</span>
  `;

  transcriptFeed.appendChild(el);
  transcriptFeed.scrollTop = transcriptFeed.scrollHeight;

  if (!liveTranscriptLines.includes(text)) {
    liveTranscriptLines.push(text);
  }

  if (speaker !== 'System') {
    pushTranscriptToBackend(speaker, text);
  }
}

// Render AI insights (structured: timestamp/confidence/owner/deadline/priority/severity/mitigation)
function renderInsights() {
  const decisions = currentInsights.decisions || [];
  const actionItems = currentInsights.actionItems || [];
  const risks = currentInsights.risks || [];

  const totalCount = decisions.length + actionItems.length + risks.length;
  const allBtn = document.querySelector('.tab-btn[data-tab="all"]');
  if (allBtn) allBtn.textContent = `All (${totalCount})`;

  const summaryCard = currentInsights.summary
    ? `<div class="insight-item insight-summary"><strong>✨ LIVE SUMMARY</strong><span class="insight-field">${currentInsights.summary}</span></div>`
    : '';

  let filtered = [];
  if (activeFilter === 'all') {
    filtered = [
      ...decisions.map((d) => ({ ...d, type: 'decision', label: 'DECISION' })),
      ...actionItems.map((a) => ({ ...a, type: 'task', label: 'ACTION ITEM' })),
      ...risks.map((r) => ({ ...r, type: 'risk', label: 'RISK FLAGGED' })),
    ];
  } else if (activeFilter === 'decisions') {
    filtered = decisions.map((d) => ({ ...d, type: 'decision', label: 'DECISION' }));
  } else if (activeFilter === 'tasks') {
    filtered = actionItems.map((a) => ({ ...a, type: 'task', label: 'ACTION ITEM' }));
  } else if (activeFilter === 'risks') {
    filtered = risks.map((r) => ({ ...r, type: 'risk', label: 'RISK FLAGGED' }));
  }

  if (filtered.length === 0) {
    insightList.innerHTML = summaryCard + `
      <div style="font-size: 11px; color: #94A3B8; text-align: center; padding: 12px 0;">
        ${isListening ? 'Recording audio... insights will appear here as they are detected.' : 'No insights recorded yet.'}
      </div>
    `;
    return;
  }

  const classMap = { decision: 'insight-decision', task: 'insight-task', risk: 'insight-risk' };

  insightList.innerHTML = summaryCard + filtered
    .slice().reverse()
    .map((item) => {
      let fields = '';
      if (item.type === 'decision') {
        fields = `Timestamp: <b>${item.timestamp || '—'}</b> · Confidence: <b>${item.confidence != null ? item.confidence + '%' : '—'}</b>`;
      } else if (item.type === 'task') {
        fields = `Owner: <b>${item.assignee || 'Unassigned'}</b> · Deadline: <b>${item.dueDate || 'Not specified'}</b> · Priority: <b>${item.priority || 'medium'}</b> · <b>${item.timestamp || ''}</b>`;
      } else {
        fields = `Severity: <b>${item.severity || 'medium'}</b> · Mitigation: <b>${item.mitigation || 'Monitor closely'}</b> · <b>${item.timestamp || ''}</b>`;
      }
      return `
        <div class="insight-item ${classMap[item.type] || 'insight-task'}">
          <strong>[${item.label}] ${item.title || item.task || item.decision || item.risk}</strong>
          <span class="insight-field">${fields}</span>
        </div>
      `;
    })
    .join('');
}

function renderFinalSummaries(finalSummaries) {
  if (!finalSummaries) return;
  const el = document.createElement('div');
  el.className = 'insight-item insight-summary';
  el.innerHTML = `
    <strong>📋 EXECUTIVE SUMMARY</strong><span class="insight-field">${finalSummaries.executive}</span>
    <strong>🔧 TECHNICAL SUMMARY</strong><span class="insight-field">${finalSummaries.technical}</span>
    <strong>🗒️ MEETING MINUTES</strong><span class="insight-field" style="white-space:pre-wrap;">${finalSummaries.minutes}</span>
  `;
  insightList.prepend(el);
}

// ─── AI Chat ───────────────────────────────────────────────────────────────
function addChatBubble(role, text) {
  if (chatMessages.children[0]?.textContent?.includes('Ask about decisions')) {
    chatMessages.innerHTML = '';
  }
  const el = document.createElement('div');
  el.className = `chat-msg ${role === 'user' ? 'chat-msg-user' : 'chat-msg-ai'}`;
  el.textContent = text;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return el;
}

async function sendChatMessage() {
  const text = (chatInput.value || '').trim();
  if (!text) return;
  chatInput.value = '';
  chatSendBtn.disabled = true;
  addChatBubble('user', text);
  const thinkingEl = addChatBubble('ai', '…thinking');

  const id = await ensureLiveMeeting();
  if (!id) {
    thinkingEl.textContent = 'Could not reach the AI backend. Is the dashboard server running on http://localhost:3000?';
    chatSendBtn.disabled = false;
    return;
  }

  const res = await callApi(`/api/live-meetings/${id}/chat`, 'POST', { message: text });
  thinkingEl.textContent = (res.ok && res.data && res.data.reply)
    ? res.data.reply
    : 'Sorry, I could not process that question right now. Please try again in a moment.';
  chatSendBtn.disabled = false;
}

chatSendBtn?.addEventListener('click', sendChatMessage);
chatInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); sendChatMessage(); }
});

// Optional live browser speech engine for real-time preview
function startBrowserSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  try {
    const instance = new SR();
    instance.continuous = true;
    instance.interimResults = true;
    const savedLang = (window.activeExtLanguage || 'en');
    instance.lang = savedLang === 'hi' ? 'hi-IN' : savedLang === 'te' ? 'te-IN' : 'en-US';

    instance.onresult = (event) => {
      if (isPaused) return;
      let interim = '';
      let finalStr = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const textStr = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) finalStr += textStr + ' ';
        else interim += textStr;
      }

      const speakerName = (speakerNameInput?.value || 'You').trim() || 'You';
      if (interim.trim()) appendTranscriptUI(speakerName, interim.trim(), true);
      if (finalStr.trim()) appendTranscriptUI(speakerName, finalStr.trim(), false);
    };

    instance.onerror = () => {};
    instance.onend = () => {
      if (isListening && !isPaused) {
        try { instance.start(); } catch (_) {}
      }
    };
    instance.start();
    return instance;
  } catch (_) {
    return null;
  }
}

// START RECORDING ACTION (IMMEDIATE UI TRANSITION)
startBtn.addEventListener('click', () => {
  // 1. INSTANT UI STATE UPDATE — Never block on promise/permission
  isListening = true;
  isPaused = false;
  audioChunks = [];
  liveTranscriptLines = [];
  lastFinalKey = '';
  currentMeetingId = null;
  meetingCreationPromise = null;

  statusBadge.className = 'status-badge recording';
  statusText.textContent = 'RECORDING AUDIO';
  startBtn.style.display = 'none';
  activeActions.style.display = 'flex';
  livePulse.style.display = 'inline';

  transcriptFeed.innerHTML = `
    <div class="placeholder-info" style="font-size: 11px; color: #34D399; text-align: center; padding: 12px; border: 1px dashed #34D399; border-radius: 8px; background: rgba(52, 211, 153, 0.05);">
      🎙️ <strong>Recording Session Active</strong><br />
      Speak into your mic or play audio. Live transcript & AI insights update continuously below.
    </div>
  `;

  currentInsights = { summary: '', decisions: [], actionItems: [], risks: [] };
  startTimer();
  renderInsights();
  ensureLiveMeeting();

  // 2. Non-blocking audio stream acquisition
  const mode = audioSource ? audioSource.value : 'tab_and_mic';

  // Try tabCapture first if available in extension
  if (typeof chrome !== 'undefined' && chrome.tabCapture && (mode === 'tab_and_mic' || mode === 'tab_only')) {
    chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
      if (stream) {
        micStream = stream;
        try {
          mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
          mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunks.push(e.data); };
          mediaRecorder.start(1000);
          console.log('[Extension] Tab MediaRecorder active.');
        } catch (e) {
          console.log('[Extension] Tab MediaRecorder notice:', e?.message || e);
        }
      } else {
        console.log('[Extension] tabCapture stream unavailable, falling back to getUserMedia.');
        requestUserMediaAudio();
      }
    });
  } else {
    requestUserMediaAudio();
  }

  // 3. Start speech recognition preview if supported
  recognition = startBrowserSpeech();
});

// Non-blocking microphone stream request
function requestUserMediaAudio() {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        micStream = stream;
        try {
          mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
          mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunks.push(e.data); };
          mediaRecorder.start(1000);
          console.log('[Extension] Microphone MediaRecorder active.');
        } catch (e) {
          console.log('[Extension] Microphone MediaRecorder notice:', e?.message || e);
        }
      })
      .catch((err) => {
        console.log('[Extension] getUserMedia notice:', err?.name || err?.message || err);
      });
  }
}

// PAUSE / RESUME
pauseBtn.addEventListener('click', () => {
  isPaused = !isPaused;
  if (isPaused) {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.pause();
    statusBadge.className = 'status-badge paused';
    statusText.textContent = 'PAUSED';
    pauseBtn.innerHTML = '<span>▶</span> Resume';
  } else {
    if (mediaRecorder && mediaRecorder.state === 'paused') mediaRecorder.resume();
    statusBadge.className = 'status-badge recording';
    statusText.textContent = 'RECORDING AUDIO';
    pauseBtn.innerHTML = '<span>⏸</span> Pause';
  }
});

// ─── Client-side WAV encoding so the recorded audio blob is ACTUALLY
// transcribed by the real Whisper pipeline server-side (lib/whisper.ts only
// decodes WAV/raw PCM — it has no ffmpeg/webm decoder, so posting the raw
// webm blob silently falls back to a canned mock transcript). Browsers can
// decode their own MediaRecorder output via the Web Audio API, so we do the
// decode + resample + PCM16 WAV encode here before uploading.
function downsampleTo16kMono(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const mono = new Float32Array(length);
  for (let ch = 0; ch < numChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += data[i] / numChannels;
  }
  if (Math.round(sampleRate) === 16000) return mono;
  const ratio = sampleRate / 16000;
  const newLength = Math.max(1, Math.round(mono.length / ratio));
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    result[i] = mono[Math.min(mono.length - 1, Math.floor(i * ratio))];
  }
  return result;
}

function encodeWavPcm16(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

async function convertRecordingToWavBlob(webmBlob) {
  const arrayBuf = await webmBlob.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
    const mono16k = downsampleTo16kMono(decoded);
    const wavBuffer = encodeWavPcm16(mono16k, 16000);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  } finally {
    try { ctx.close(); } catch (_) {}
  }
}

// STOP & ANALYZE (Transcribe with Whisper + LlamaCloud Extraction)
stopBtn.addEventListener('click', async () => {
  isListening = false;
  stopTimer();

  statusBadge.className = 'status-badge';
  statusText.textContent = 'PROCESSING AUDIO...';
  activeActions.style.display = 'none';
  livePulse.style.display = 'none';

  if (recognition) {
    try { recognition.stop(); } catch (_) {}
  }

  // Stop MediaRecorder and mic stream
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch (_) {}
  }
  if (micStream) {
    try { micStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
    micStream = null;
  }

  // Fetch the end-of-session Executive/Technical/Minutes summaries from the
  // live-meeting session that's been tracking this recording in real time.
  if (currentMeetingId) {
    callApi(`/api/live-meetings/${currentMeetingId}`, 'PATCH', { action: 'end' }).then((res) => {
      if (res.ok && res.data && res.data.meeting) {
        renderFinalSummaries(res.data.meeting.finalSummaries);
      }
    }).catch(() => {});
  }

  // Show processing placeholder
  const procEl = document.createElement('div');
  procEl.className = 'placeholder-info';
  procEl.style.cssText = 'font-size: 11px; color: #a5b4fc; text-align: center; padding: 12px; border: 1px dashed #6366F1; border-radius: 8px; background: rgba(99, 102, 241, 0.08); margin-top: 10px;';
  procEl.innerHTML = `⏳ <strong>Transcribing & Analyzing Audio...</strong><br />Running Whisper STT and AI extraction engine. Please wait a moment...`;
  transcriptFeed.appendChild(procEl);
  transcriptFeed.scrollTop = transcriptFeed.scrollHeight;

  // Wait brief moment for audio chunk flush
  await new Promise((r) => setTimeout(r, 600));

  try {
    let res = null;

    if (audioChunks.length > 0) {
      const rawBlob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log(`[Extension] Recorded Audio Blob Size: ${rawBlob.size} bytes`);

      let uploadBlob = rawBlob;
      let uploadName = `extension-rec-${Date.now()}.webm`;
      try {
        uploadBlob = await convertRecordingToWavBlob(rawBlob);
        uploadName = `extension-rec-${Date.now()}.wav`;
      } catch (convErr) {
        console.log('[Extension] WAV conversion notice (falling back to raw blob):', convErr?.message || convErr);
      }

      const formData = new FormData();
      formData.append('file', uploadBlob, uploadName);
      formData.append('title', `Extension Meeting ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);

      res = await fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
    } else if (liveTranscriptLines.length > 0) {
      // Fallback if no audio bytes captured but text lines exist
      const fullText = liveTranscriptLines.join('\n');
      const formData = new FormData();
      const blob = new Blob([fullText], { type: 'text/plain' });
      formData.append('file', blob, 'transcript.txt');
      formData.append('title', `Extension Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);

      res = await fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
    }

    procEl.remove();

    if (res && res.ok) {
      const data = await res.json();
      console.log('[Extension] Meeting created & analyzed:', data);

      // Update Transcript feed with Whisper transcription
      if (data.transcript && data.transcript.trim()) {
        const transcriptContainer = document.createElement('div');
        transcriptContainer.style.cssText = 'margin-top: 10px; padding: 10px; border-radius: 8px; background: #12141d; border: 1px solid #232B45; color: #f8fafc; font-size: 12px; line-height: 1.5;';
        transcriptContainer.innerHTML = `<strong style="color: #6366F1;">🎙️ Transcribed Audio (Whisper STT):</strong><p style="margin-top: 4px;">${data.transcript}</p>`;
        transcriptFeed.appendChild(transcriptContainer);
      }

      // Merge the deep post-meeting LlamaCloud/Anthropic extraction into the
      // live, structured insights that have been building throughout the call.
      if (data.analysis) {
        currentInsights = {
          summary: data.analysis.summary || currentInsights.summary,
          decisions: (data.analysis.decisions || []).map((d, i) => ({ id: `d-${i}`, title: d.decision, detail: d.context, timestamp: '—', confidence: 90 })),
          actionItems: (data.analysis.actionItems || []).map((a, i) => ({ id: `a-${i}`, title: a.task, assignee: a.assignee, dueDate: a.dueDate, priority: 'medium' })),
          risks: (data.analysis.risks || []).map((r, i) => ({ id: `r-${i}`, title: r.risk, severity: r.impact || 'medium', mitigation: r.mitigation })),
        };
        renderInsights();
      }

      // Show completion banner
      statusText.textContent = 'SAVED & ANALYZED';
      const completeBanner = document.createElement('div');
      completeBanner.style.cssText = 'margin-top: 10px; padding: 10px; border-radius: 8px; background: rgba(52, 211, 153, 0.1); border: 1px solid #34D399; font-size: 11px; color: #f8fafc;';
      completeBanner.innerHTML = `
        <strong style="color: #34D399;">✔ Meeting Saved to Database & Analyzed!</strong><br />
        <a href="${BACKEND_URL}/dashboard/meeting/${data.id}" target="_blank" style="color: #34D399; text-decoration: underline; font-weight: bold; margin-top: 4px; display: inline-block;">
          Open Full Meeting Details on Dashboard ↗
        </a>
      `;
      transcriptFeed.appendChild(completeBanner);

    } else {
      const errBanner = document.createElement('div');
      errBanner.style.cssText = 'margin-top: 10px; padding: 10px; border-radius: 8px; background: rgba(99, 102, 241, 0.1); border: 1px solid #6366F1; font-size: 11px; color: #a5b4fc;';
      errBanner.innerHTML = `<strong>Meeting Recorded!</strong> Open your dashboard to view meetings: <a href="${BACKEND_URL}/dashboard" target="_blank" style="color: #6366F1; font-weight: bold;">Dashboard ↗</a>`;
      transcriptFeed.appendChild(errBanner);
    }

  } catch (err) {
    console.log('Audio processing notice:', err?.message || err);
    if (procEl) procEl.remove();

    const errBanner = document.createElement('div');
    errBanner.style.cssText = 'margin-top: 10px; padding: 10px; border-radius: 8px; background: rgba(99, 102, 241, 0.1); border: 1px solid #6366F1; font-size: 11px; color: #a5b4fc;';
    errBanner.innerHTML = `<strong>Recording Completed!</strong> View all meetings on <a href="${BACKEND_URL}/dashboard" target="_blank" style="color: #6366F1; font-weight: bold;">Dashboard ↗</a>`;
    transcriptFeed.appendChild(errBanner);
  }

  startBtn.style.display = 'flex';
  startBtn.disabled = false;
  startBtn.innerHTML = '<span>▶</span> Start New Meeting';
  transcriptFeed.scrollTop = transcriptFeed.scrollHeight;
});

// Manual text input send handler
async function handleManualSend() {
  if (!manualInput) return;
  const val = manualInput.value.trim();
  if (!val) return;

  appendTranscriptUI((speakerNameInput?.value || 'You').trim() || 'You', val, false);
  manualInput.value = '';
}

sendBtn?.addEventListener('click', () => void handleManualSend());
manualInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    void handleManualSend();
  }
});
