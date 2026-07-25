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
const manualInput = document.getElementById('manualInput');
const sendBtn = document.getElementById('sendBtn');

// Tab Filter Buttons
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    activeFilter = e.currentTarget.getAttribute('data-tab') || 'all';
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

// Append transcript item to UI feed
function appendTranscriptUI(speaker, text, isInterim = false) {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Remove placeholder info if present
  const placeholder = transcriptFeed.querySelector('.placeholder-info');
  if (placeholder) placeholder.remove();

  // Handle interim live line
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

  // Remove interim element
  if (interimEl) interimEl.remove();

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
}

// Render AI insights
function renderInsights() {
  const decisions = currentInsights.decisions || [];
  const actionItems = currentInsights.actionItems || [];
  const risks = currentInsights.risks || [];

  const totalCount = decisions.length + actionItems.length + risks.length;
  const allBtn = document.querySelector('.tab-btn[data-tab="all"]');
  if (allBtn) allBtn.textContent = `All (${totalCount})`;

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
    insightList.innerHTML = `
      <div style="font-size: 11px; color: #94A3B8; text-align: center; padding: 12px 0;">
        ${isListening ? 'Recording audio... Click "Stop & Analyze" to generate transcript & insights.' : 'No insights recorded yet.'}
      </div>
    `;
    return;
  }

  const classMap = {
    decision: 'insight-decision',
    task: 'insight-task',
    risk: 'insight-risk',
  };

  insightList.innerHTML = filtered
    .map(
      (item) => `
    <div class="insight-item ${classMap[item.type] || 'insight-task'}">
      <strong>[${item.label}] ${item.title || item.task || item.decision || item.risk}</strong>
      <span>${item.detail || item.context || item.mitigation || (item.assignee ? `Assigned to ${item.assignee}` : '')}</span>
    </div>
  `
    )
    .join('');
}

// Optional live browser speech engine for real-time preview
function startBrowserSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  try {
    const instance = new SR();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = 'en-US';

    instance.onresult = (event) => {
      if (isPaused) return;
      let interim = '';
      let finalStr = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const textStr = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) finalStr += textStr + ' ';
        else interim += textStr;
      }

      if (interim.trim()) appendTranscriptUI('Speaker', interim.trim(), true);
      if (finalStr.trim()) appendTranscriptUI('Speaker', finalStr.trim(), false);
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

  statusBadge.className = 'status-badge recording';
  statusText.textContent = 'RECORDING AUDIO';
  startBtn.style.display = 'none';
  activeActions.style.display = 'flex';
  livePulse.style.display = 'inline';

  transcriptFeed.innerHTML = `
    <div class="placeholder-info" style="font-size: 11px; color: #34D399; text-align: center; padding: 12px; border: 1px dashed #34D399; border-radius: 8px; background: rgba(52, 211, 153, 0.05);">
      🎙️ <strong>Recording Session Active</strong><br />
      Speak into your mic or play audio. When finished, click <strong>Stop & Analyze</strong> for Whisper STT + LlamaCloud extraction!
    </div>
  `;

  currentInsights = { summary: '', decisions: [], actionItems: [], risks: [] };
  startTimer();
  renderInsights();

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
          console.log('[Extension] Tab audio capture active.');
        } catch (e) {
          console.warn('[Extension] Tab MediaRecorder error:', e);
        }
      } else {
        console.warn('[Extension] tabCapture stream unavailable, falling back to getUserMedia.');
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
          console.warn('[Extension] Microphone MediaRecorder error:', e);
        }
      })
      .catch((err) => {
        console.warn('[Extension] getUserMedia note:', err);
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

  // Show processing placeholder
  const procEl = document.createElement('div');
  procEl.className = 'placeholder-info';
  procEl.style.cssText = 'font-size: 11px; color: #a5b4fc; text-align: center; padding: 12px; border: 1px dashed #6366F1; border-radius: 8px; background: rgba(99, 102, 241, 0.08); margin-top: 10px;';
  procEl.innerHTML = `⏳ <strong>Transcribing & Analyzing Audio...</strong><br />Running Whisper STT and LlamaCloud extraction engine. Please wait a moment...`;
  transcriptFeed.appendChild(procEl);
  transcriptFeed.scrollTop = transcriptFeed.scrollHeight;

  // Wait brief moment for audio chunk flush
  await new Promise((r) => setTimeout(r, 600));

  try {
    let res = null;

    if (audioChunks.length > 0) {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log(`[Extension] Recorded Audio Blob Size: ${audioBlob.size} bytes`);

      const formData = new FormData();
      const fileName = `extension-rec-${Date.now()}.webm`;
      formData.append('file', audioBlob, fileName);
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
      currentMeetingId = data.id;

      // Update Transcript feed with Whisper transcription
      if (data.transcript && data.transcript.trim()) {
        const transcriptContainer = document.createElement('div');
        transcriptContainer.style.cssText = 'margin-top: 10px; padding: 10px; border-radius: 8px; background: #12141d; border: 1px solid #232B45; color: #f8fafc; font-size: 12px; line-height: 1.5;';
        transcriptContainer.innerHTML = `<strong style="color: #6366F1;">🎙️ Transcribed Audio (Whisper STT):</strong><p style="margin-top: 4px;">${data.transcript}</p>`;
        transcriptFeed.appendChild(transcriptContainer);
      }

      // Update Insights panel with LlamaCloud extractions
      if (data.analysis) {
        currentInsights = {
          summary: data.analysis.summary || '',
          decisions: (data.analysis.decisions || []).map((d, i) => ({ id: `d-${i}`, title: d.decision, detail: d.context })),
          actionItems: (data.analysis.actionItems || []).map((a, i) => ({ id: `a-${i}`, title: a.task, detail: a.assignee ? `Assigned to ${a.assignee}` : '' })),
          risks: (data.analysis.risks || []).map((r, i) => ({ id: `r-${i}`, title: r.risk, detail: r.mitigation })),
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
    console.error('Audio processing note:', err);
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

  appendTranscriptUI('You', val, false);
  manualInput.value = '';
}

sendBtn?.addEventListener('click', () => void handleManualSend());
manualInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    void handleManualSend();
  }
});
