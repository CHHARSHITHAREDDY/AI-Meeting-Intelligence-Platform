(function () {
  const existingHost = document.getElementById('weave-widget-host');
  if (existingHost) {
    existingHost.style.display = existingHost.style.display === 'none' ? 'block' : 'none';
    return;
  }

  const BACKEND_URL = 'http://localhost:3000';

  // 1. Create Host Element & Shadow DOM (HIDDEN BY DEFAULT - ONLY VISIBLE ON EXPLICIT USER TOGGLE)
  const host = document.createElement('div');
  host.id = 'weave-widget-host';
  host.style.position = 'fixed';
  host.style.top = '20px';
  host.style.right = '20px';
  host.style.zIndex = '2147483647';
  host.style.width = '420px';
  host.style.height = '540px';
  host.style.minWidth = '220px';
  host.style.minHeight = '70px';
  host.style.resize = 'both';
  host.style.overflow = 'hidden';
  host.style.borderRadius = '16px';
  host.style.display = 'none'; // STRICTLY HIDDEN UNTIL USER CLICKS INJECT IN POPUP
  host.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(99, 102, 241, 0.3)';

  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  // Listen for toggle message from popup.js
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === 'TOGGLE_WIDGET') {
        host.style.display = host.style.display === 'none' ? 'block' : 'none';
        sendResponse({ visible: host.style.display === 'block' });
      }
    });
  }

  // 2. Inject Encapsulated Styles
  const style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }

    .widget-container {
      width: 100%;
      height: 100%;
      background: rgba(13, 14, 21, 0.95);
      backdrop-filter: blur(16px);
      color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      position: relative;
    }

    /* Drag Handle Header */
    .drag-handle {
      padding: 10px 12px;
      background: #0d0e15;
      border-bottom: 1px solid #1c1f29;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: grab;
      flex-shrink: 0;
    }

    .drag-handle:active { cursor: grabbing; }

    .brand-group { display: flex; align-items: center; gap: 8px; }

    .logo-mark {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: linear-gradient(135deg, #6366F1, #EC4899);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 12px;
      font-weight: bold;
    }

    .brand-name {
      font-size: 13px;
      font-weight: 700;
      color: #f8fafc;
    }

    .status-badge {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 10px;
      font-weight: 700;
      font-family: monospace;
      padding: 3px 8px;
      border-radius: 9999px;
      background: #181b25;
      color: #94A3B8;
      border: 1px solid #232B45;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #94A3B8;
    }

    .status-badge.recording .status-dot {
      background: #EF4444;
      box-shadow: 0 0 8px #EF4444;
      animation: pulse 1.2s infinite ease-in-out;
    }

    .status-badge.recording { color: #f8fafc; border-color: rgba(239, 68, 68, 0.4); }

    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

    /* Controls Bar */
    .controls-bar {
      padding: 10px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      background: rgba(18, 20, 29, 0.8);
      border-bottom: 1px solid #1c1f29;
      flex-shrink: 0;
    }

    .timer-and-name { display: flex; align-items: center; gap: 6px; }

    #speakerNameInput {
      width: 56px;
      background: #0d0e15;
      border: 1px solid #232B45;
      color: #c0c1ff;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 5px;
      border-radius: 5px;
      outline: none;
      font-family: inherit;
    }
    #speakerNameInput:focus { border-color: #6366F1; }

    /* Audio Source Selector Bar */
    .audio-source-bar {
      padding: 6px 12px;
      background: #11131c;
      border-bottom: 1px solid #1c1f29;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .source-label {
      font-size: 9px;
      font-weight: 700;
      font-family: monospace;
      color: #94A3B8;
      letter-spacing: 0.5px;
    }

    .source-toggle-group {
      display: flex;
      gap: 3px;
      background: #181b25;
      padding: 2px;
      border-radius: 6px;
      border: 1px solid #232B45;
    }

    .source-btn {
      padding: 3px 8px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: #94A3B8;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .source-btn:hover { color: #f8fafc; }

    .source-btn.active {
      background: linear-gradient(135deg, #6366F1, #818CF8);
      color: #ffffff;
      font-weight: 700;
      box-shadow: 0 0 8px rgba(99, 102, 241, 0.4);
    }

    .timer-display {
      font-family: monospace;
      font-size: 16px;
      font-weight: 700;
      color: #c0c1ff;
    }

    .btn-record {
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      background: linear-gradient(135deg, #6366F1, #EC4899);
      color: #fff;
      font-weight: 700;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.4);
    }

    .btn-icon {
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid #232B45;
      background: #181b25;
      color: #c7c4d7;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-stop { border-color: rgba(239, 68, 68, 0.4); color: #ffb4ab; }

    .btn-summarize {
      padding: 6px 10px;
      border-radius: 6px;
      border: none;
      background: linear-gradient(135deg, #8B5CF6, #EC4899);
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      box-shadow: 0 0 10px rgba(139, 92, 246, 0.4);
    }
    .btn-summarize:hover { opacity: 0.9; }
    .btn-summarize:disabled { opacity: 0.5; cursor: default; }

    /* Transcript Stream Section */
    .transcript-section {
      flex: 1;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-bottom: 1px solid #1c1f29;
    }

    .section-header {
      font-size: 10px;
      font-weight: 700;
      font-family: monospace;
      color: #94A3B8;
      text-transform: uppercase;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .transcript-feed {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      user-select: text;
    }

    .transcript-block {
      font-size: 11px;
      line-height: 1.4;
      color: #dfe2ef;
      background: rgba(24, 27, 37, 0.7);
      padding: 6px 8px;
      border-radius: 6px;
      border-left: 3px solid #6366F1;
    }

    .transcript-block.speaker-System { border-left-color: #94A3B8; opacity: 0.85; font-style: italic; }
    .transcript-block.speaker-Computer-Audio { border-left-color: #34D399; }
    .transcript-block.interim-line { opacity: 0.65; font-style: italic; border-left-color: #a5b4fc; }

    .transcript-speaker { font-weight: 700; color: #c0c1ff; font-size: 11px; margin-bottom: 2px; }
    .transcript-utterance { display: flex; gap: 6px; align-items: baseline; }
    .utterance-time { font-size: 9px; color: #6b7280; font-family: monospace; flex-shrink: 0; }
    .utterance-text { flex: 1; }

    /* Insights Section */
    .insights-section {
      padding: 10px 12px;
      height: 168px;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      overflow: hidden;
    }

    .insight-tabs { display: flex; gap: 4px; }
    .insight-tab-btn {
      border: none;
      background: transparent;
      color: #94A3B8;
      font-size: 9.5px;
      font-weight: 700;
      font-family: monospace;
      padding: 2px 6px;
      border-radius: 4px;
      cursor: pointer;
    }
    .insight-tab-btn.active { background: #6366F1; color: #fff; }

    .insight-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 4px;
    }

    .insight-item {
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 10.5px;
      line-height: 1.35;
    }
    .insight-item .insight-field { color: #94A3B8; font-size: 9.5px; }
    .insight-item .insight-field b { color: #dfe2ef; font-weight: 600; }

    .insight-decision { background: rgba(52, 211, 153, 0.08); border-left: 3px solid #34D399; color: #a7f3d0; }
    .insight-task { background: rgba(192, 193, 255, 0.08); border-left: 3px solid #c0c1ff; color: #e0e7ff; }
    .insight-risk { background: rgba(255, 180, 171, 0.08); border-left: 3px solid #ffb4ab; color: #fecdd3; }
    .insight-question { background: rgba(245, 158, 11, 0.08); border-left: 3px solid #f59e0b; color: #fef3c7; }
    .insight-summary { background: rgba(139, 92, 246, 0.15); border-left: 3px solid #a855f7; color: #f3e8ff; }

    /* Chat Panel */
    .chat-panel { flex: 1; display: none; flex-direction: column; margin-top: 4px; overflow: hidden; }
    .chat-panel.active { display: flex; }
    .chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 2px; }
    .chat-msg { font-size: 10.5px; line-height: 1.35; padding: 6px 8px; border-radius: 8px; max-width: 92%; }
    .chat-msg-user { align-self: flex-end; background: rgba(99, 102, 241, 0.25); color: #e0e7ff; }
    .chat-msg-ai { align-self: flex-start; background: rgba(255, 255, 255, 0.06); color: #dfe2ef; white-space: pre-wrap; }
    .chat-input-row { display: flex; gap: 4px; margin-top: 6px; flex-shrink: 0; }
    .chat-input {
      flex: 1; background: #0d0e15; border: 1px solid #232B45; color: #f8fafc;
      font-size: 10.5px; padding: 5px 8px; border-radius: 6px; outline: none; font-family: inherit;
    }
    .chat-input:focus { border-color: #6366F1; }
    .chat-send-btn {
      background: #6366F1; border: none; color: #fff; font-size: 10px; font-weight: 700;
      padding: 5px 10px; border-radius: 6px; cursor: pointer;
    }
    .chat-send-btn:disabled { opacity: 0.5; cursor: default; }

    /* Export & Workflow Toolbar */
    .export-toolbar {
      padding: 6px 12px;
      background: #0f1118;
      border-top: 1px solid #1c1f29;
      display: flex;
      gap: 4px;
      overflow-x: auto;
      flex-shrink: 0;
    }
    .export-btn {
      padding: 3px 7px;
      border: 1px solid #232B45;
      border-radius: 4px;
      background: #181b25;
      color: #cbd5e1;
      font-size: 9.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
    }
    .export-btn:hover {
      background: #232B45;
      color: #ffffff;
      border-color: #6366F1;
    }

    /* Resize Handle Watermark */
    .resize-watermark {
      position: absolute;
      bottom: 2px;
      right: 4px;
      font-size: 9px;
      color: #94A3B8;
      pointer-events: none;
    }

    /* ─── ADAPTIVE VIEW MODES ─── */
    /* Mode 3: Compact Pill View (Small size) */
    .widget-container.mode-pill .transcript-section,
    .widget-container.mode-pill .insights-section {
      display: none !important;
    }
    .widget-container.mode-pill .controls-bar {
      border-bottom: none;
      padding: 6px 10px;
    }

    /* Mode 2: Medium Transcript View */
    .widget-container.mode-transcript .insights-section {
      display: none !important;
    }
  `;
  shadow.appendChild(style);

  // 3. Inject HTML Structure
  const wrapper = document.createElement('div');
  wrapper.className = 'widget-container mode-full';
  wrapper.innerHTML = `
    <!-- Header / Drag Handle -->
    <div class="drag-handle" id="dragHandle">
      <div class="brand-group">
        <div class="logo-mark">✦</div>
        <span class="brand-name">Cue AI</span>
      </div>
      <div id="statusBadge" class="status-badge">
        <span class="status-dot"></span>
        <span id="statusText">IDLE</span>
      </div>
      <button id="closeBtn" style="background:none; border:none; color:#94A3B8; cursor:pointer; font-size:12px; font-weight:bold;">✕</button>
    </div>

    <!-- Controls Bar -->
    <div class="controls-bar">
      <div class="timer-and-name">
        <span id="timerDisplay" class="timer-display">00:00:00</span>
        <input id="speakerNameInput" type="text" value="You" title="Your name in the transcript" />
      </div>
      <div style="display: flex; gap: 6px;">
        <button id="startBtn" class="btn-record">▶ Start</button>
        <button id="pauseBtn" class="btn-icon" style="display:none;">⏸</button>
        <button id="summarizeBtn" class="btn-summarize" style="display:none;">✨ Summarize</button>
        <button id="stopBtn" class="btn-icon btn-stop" style="display:none;">⏹ Stop</button>
      </div>
    </div>

    <!-- Audio Source Selector Bar -->
    <div class="audio-source-bar">
      <span class="source-label">AUDIO SOURCE:</span>
      <div class="source-toggle-group">
        <button id="srcMicBtn" class="source-btn active" title="Microphone Audio (Live Voice)">🎙️ Mic</button>
        <button id="srcCompBtn" class="source-btn" title="Computer / Tab Audio (System / Video)">💻 Computer</button>
        <button id="srcBothBtn" class="source-btn" title="Both Mic & Computer Audio">🎙️+💻 Both</button>
      </div>
    </div>

    <!-- Transcript Stream Section -->
    <div class="transcript-section">
      <div class="section-header">
        <span>Live Transcript Stream</span>
        <span id="livePulse" style="color:#34D399; display:none;">● STREAMING</span>
      </div>
      <div id="transcriptFeed" class="transcript-feed">
        <div style="font-size: 10px; color: #94A3B8; text-align: center; margin: auto;">
          Click ▶ Start to begin live audio recording.
        </div>
      </div>
    </div>

    <!-- Insights Section -->
    <div class="insights-section">
      <div class="section-header">
        <span>Real-Time Intelligence</span>
        <div class="insight-tabs">
          <button id="tabIntelBtn" class="insight-tab-btn active">Intel</button>
          <button id="tabChatBtn" class="insight-tab-btn">Chat</button>
        </div>
      </div>
      <div id="insightList" class="insight-list">
        <div style="font-size: 10px; color: #94A3B8; text-align: center; margin: auto;">
          Listening for key decisions & tasks...
        </div>
      </div>
      <div id="chatPanel" class="chat-panel">
        <div id="chatMessages" class="chat-messages">
          <div style="font-size: 10px; color: #94A3B8; text-align: center; margin: auto;">
            Ask about decisions, tasks, risks, or anything said so far.
          </div>
        </div>
        <div class="chat-input-row">
          <input id="chatInput" class="chat-input" type="text" placeholder="Ask AI about this meeting..." />
          <button id="chatSendBtn" class="chat-send-btn">Send</button>
        </div>
      </div>
    </div>

    <!-- Export & Workflow Toolbar -->
    <div class="export-toolbar">
      <button id="expEmailBtn" class="export-btn" title="Copy Executive Email Digest">📧 Email Brief</button>
      <button id="expSlackBtn" class="export-btn" title="Copy Slack Formatting">💬 Slack Digest</button>
      <button id="expJiraBtn" class="export-btn" title="Copy Jira/GitHub Tasks">🎟️ Jira/Tasks</button>
      <button id="expStatsBtn" class="export-btn" title="View Speaker Analytics & Efficiency">📊 Speaker Stats</button>
    </div>

    <div class="resize-watermark">◢</div>
  `;

  shadow.appendChild(wrapper);

  // 4. Element References inside Shadow DOM
  const dragHandle = shadow.getElementById('dragHandle');
  const closeBtn = shadow.getElementById('closeBtn');
  const startBtn = shadow.getElementById('startBtn');
  const pauseBtn = shadow.getElementById('pauseBtn');
  const stopBtn = shadow.getElementById('stopBtn');
  const summarizeBtn = shadow.getElementById('summarizeBtn');
  const statusBadge = shadow.getElementById('statusBadge');
  const statusText = shadow.getElementById('statusText');
  const timerDisplay = shadow.getElementById('timerDisplay');
  const speakerNameInput = shadow.getElementById('speakerNameInput');
  const transcriptFeed = shadow.getElementById('transcriptFeed');
  const insightList = shadow.getElementById('insightList');
  const livePulse = shadow.getElementById('livePulse');

  const srcMicBtn = shadow.getElementById('srcMicBtn');
  const srcCompBtn = shadow.getElementById('srcCompBtn');
  const srcBothBtn = shadow.getElementById('srcBothBtn');

  const tabIntelBtn = shadow.getElementById('tabIntelBtn');
  const tabChatBtn = shadow.getElementById('tabChatBtn');
  const chatPanel = shadow.getElementById('chatPanel');
  const chatMessages = shadow.getElementById('chatMessages');
  const chatInput = shadow.getElementById('chatInput');
  const chatSendBtn = shadow.getElementById('chatSendBtn');

  let selectedAudioSource = 'mic'; // 'mic' | 'comp' | 'both'

  function updateAudioSourceUI(source) {
    if (statusText.textContent === 'REC' || statusText.textContent === 'PAUSED') return;
    selectedAudioSource = source;
    srcMicBtn.classList.toggle('active', source === 'mic');
    srcCompBtn.classList.toggle('active', source === 'comp');
    srcBothBtn.classList.toggle('active', source === 'both');
  }

  srcMicBtn.addEventListener('click', () => updateAudioSourceUI('mic'));
  srcCompBtn.addEventListener('click', () => updateAudioSourceUI('comp'));
  srcBothBtn.addEventListener('click', () => updateAudioSourceUI('both'));

  // 5. Drag & Drop Implementation
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  dragHandle.addEventListener('mousedown', (e) => {
    if (e.target === closeBtn) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = host.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    host.style.right = 'auto'; // release right constraint
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    host.style.left = `${initialLeft + dx}px`;
    host.style.top = `${initialTop + dy}px`;
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  closeBtn.addEventListener('click', () => { host.style.display = 'none'; });

  // 6. Adaptive Responsive Layout Engine (ResizeObserver)
  const resizeObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;

      wrapper.classList.remove('mode-full', 'mode-transcript', 'mode-pill');

      if (width < 260 || height < 200) {
        wrapper.classList.add('mode-pill');
      } else if (width < 360 || height < 400) {
        wrapper.classList.add('mode-transcript');
      } else {
        wrapper.classList.add('mode-full');
      }
    }
  });

  resizeObserver.observe(wrapper);

  // 7. Extension <-> Backend Bridge (relayed through the background service
  // worker so requests aren't subject to the host page's mixed-content/CORS
  // restrictions — see extension/background.js).
  function callApi(path, method, body) {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        resolve({ ok: false, error: 'chrome.runtime unavailable' });
        return;
      }
      try {
        chrome.runtime.sendMessage({ type: 'CUE_API', path, method, body }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { ok: false });
        });
      } catch (err) {
        resolve({ ok: false, error: err?.message || String(err) });
      }
    });
  }

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function callApiBinary(path, arrayBuffer) {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        resolve({ ok: false, error: 'chrome.runtime unavailable' });
        return;
      }
      try {
        chrome.runtime.sendMessage({ type: 'CUE_API_BINARY', path, base64: arrayBufferToBase64(arrayBuffer) }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { ok: false });
        });
      } catch (err) {
        resolve({ ok: false, error: err?.message || String(err) });
      }
    });
  }

  // Serialize backend transcript pushes so utterances are appended in the
  // order they were spoken, and the UI never fires two live-insight rebuilds
  // concurrently for the same meeting.
  let apiQueue = Promise.resolve();
  function enqueue(fn) {
    apiQueue = apiQueue.then(fn, fn);
    return apiQueue;
  }

  let meetingId = null;
  let meetingCreationPromise = null;

  function ensureLiveMeeting() {
    if (meetingId) return Promise.resolve(meetingId);
    if (meetingCreationPromise) return meetingCreationPromise;

    meetingCreationPromise = callApi('/api/live-meetings', 'POST', {
      title: document.title ? `Cue Session — ${document.title}`.slice(0, 120) : 'Cue Live Session',
      hostName: (speakerNameInput.value || 'You').trim() || 'You',
    }).then((res) => {
      if (res.ok && res.data && res.data.meeting) {
        meetingId = res.data.meeting.id;
        callApi(`/api/live-meetings/${meetingId}`, 'PATCH', { action: 'start' }).catch(() => {});
      }
      return meetingId;
    }).catch(() => null);

    return meetingCreationPromise;
  }

  // 8. Recorder Engine
  let timerInterval = null;
  let seconds = 0;
  let isPaused = false;
  let recognitionInstance = null;
  let captionObserver = null;
  const seenCaptions = new Set();

  function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  function nowClock() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // ─── Transcript rendering: grouped by speaker, timestamped, deduped ───────
  let lastBlockEl = null;
  let lastBlockSpeaker = null;
  let lastBlockTime = 0;
  let lastFinalKey = '';
  const GROUP_WINDOW_MS = 45000;

  function speakerCssClass(speaker) {
    return `speaker-${String(speaker).replace(/[^a-zA-Z0-9]+/g, '-')}`;
  }

  function appendTranscriptLine(speaker, text, isInterim = false) {
    if (!text || !text.trim()) return;
    text = text.trim();

    if (transcriptFeed.querySelector('div')?.textContent?.includes('Click ▶ Start')) {
      transcriptFeed.innerHTML = '';
    }

    let interimEl = transcriptFeed.querySelector('.interim-line');
    if (isInterim) {
      if (!interimEl) {
        interimEl = document.createElement('div');
        interimEl.className = 'transcript-block interim-line';
        transcriptFeed.appendChild(interimEl);
      }
      interimEl.innerHTML = `<div class="transcript-speaker">${speaker} (speaking...)</div><div class="transcript-utterance"><span class="utterance-text">${escapeHtml(text)}</span></div>`;
      transcriptFeed.scrollTop = transcriptFeed.scrollHeight;
      return;
    }

    if (interimEl) interimEl.remove();

    // Prevent duplicate transcript entries (e.g. speech-recognition restarts
    // occasionally re-emitting the same final result).
    const dedupeKey = `${speaker}::${text.toLowerCase()}`;
    if (dedupeKey === lastFinalKey) return;
    lastFinalKey = dedupeKey;

    const now = Date.now();
    const canGroup = lastBlockEl && lastBlockSpeaker === speaker && (now - lastBlockTime) < GROUP_WINDOW_MS;

    const utteranceHtml = `<div class="transcript-utterance"><span class="utterance-time">${nowClock()}</span><span class="utterance-text">${escapeHtml(text)}</span></div>`;

    if (canGroup) {
      lastBlockEl.insertAdjacentHTML('beforeend', utteranceHtml);
    } else {
      const block = document.createElement('div');
      block.className = `transcript-block ${speakerCssClass(speaker)}`;
      block.innerHTML = `<div class="transcript-speaker">${escapeHtml(speaker)}</div>${utteranceHtml}`;
      transcriptFeed.appendChild(block);
      lastBlockEl = block;
      lastBlockSpeaker = speaker;
    }
    lastBlockTime = now;
    transcriptFeed.scrollTop = transcriptFeed.scrollHeight;

    if (speaker !== 'System') {
      pushTranscriptToBackend(speaker, text);
      previewLocalInsight(text);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Instant local keyword preview so the panel doesn't feel empty while the
  // (fast, but not zero-latency) backend round-trip is in flight. The server
  // response fully replaces this the moment it arrives.
  function previewLocalInsight(text) {
    const lower = text.toLowerCase();
    if (lower.includes('decid') || lower.includes('agree') || lower.includes('approved')) {
      addInsightPreview('insight-decision', 'DECISION', text);
    } else if (lower.includes('action') || lower.includes('todo') || lower.includes('assigned') || lower.includes('will ')) {
      addInsightPreview('insight-task', 'TASK', text);
    } else if (lower.includes('risk') || lower.includes('worry') || lower.includes('blocked') || lower.includes('issue')) {
      addInsightPreview('insight-risk', 'RISK', text);
    } else if (lower.includes('?') || /^(how|what|why|who|when|can we)/.test(lower)) {
      addInsightPreview('insight-question', 'QUESTION', text);
    }
  }

  function addInsightPreview(cls, tag, txt) {
    if (insightList.children[0]?.textContent?.includes('Listening')) {
      insightList.innerHTML = '';
    }
    const el = document.createElement('div');
    el.className = `insight-item ${cls} insight-preview`;
    el.innerHTML = `<strong>[${tag}]</strong> ${escapeHtml(txt)}`;
    insightList.appendChild(el);
    insightList.scrollTop = insightList.scrollHeight;
  }

  // ─── Push each final utterance to the backend; render authoritative,
  // structured decisions/actions/risks/summary the moment the response lands.
  function pushTranscriptToBackend(speaker, text) {
    enqueue(async () => {
      const id = await ensureLiveMeeting();
      if (!id) return;
      const res = await callApi(`/api/live-meetings/${id}`, 'POST', { text, speaker, timestamp: nowClock() });
      if (res.ok && res.data && res.data.meeting) {
        renderInsights(res.data.meeting.insights);
      }
    });
  }

  let latestInsights = { summary: '', decisions: [], actionItems: [], risks: [] };
  let activeIntelTab = 'intel';

  function renderInsights(insights) {
    if (!insights) return;
    latestInsights = insights;
    if (activeIntelTab !== 'intel') return;

    insightList.innerHTML = '';

    if (insights.summary) {
      const summaryCard = document.createElement('div');
      summaryCard.className = 'insight-item insight-summary';
      summaryCard.innerHTML = `<strong>✨ LIVE SUMMARY</strong><br/><span style="font-size:10px; opacity:0.95;">${escapeHtml(insights.summary)}</span>`;
      insightList.appendChild(summaryCard);
    }

    (insights.decisions || []).slice().reverse().forEach((d) => {
      const el = document.createElement('div');
      el.className = 'insight-item insight-decision';
      el.innerHTML = `<strong>[DECISION]</strong> ${escapeHtml(d.title)}<br/>
        <span class="insight-field">Timestamp: <b>${d.timestamp || '—'}</b> · Confidence: <b>${d.confidence != null ? d.confidence + '%' : '—'}</b></span>`;
      insightList.appendChild(el);
    });

    (insights.actionItems || []).slice().reverse().forEach((a) => {
      const el = document.createElement('div');
      el.className = 'insight-item insight-task';
      el.innerHTML = `<strong>[TASK]</strong> ${escapeHtml(a.title)}<br/>
        <span class="insight-field">Owner: <b>${escapeHtml(a.assignee || 'Unassigned')}</b> · Deadline: <b>${escapeHtml(a.dueDate || 'Not specified')}</b> · Priority: <b>${a.priority || 'medium'}</b> · <b>${a.timestamp || ''}</b></span>`;
      insightList.appendChild(el);
    });

    (insights.risks || []).slice().reverse().forEach((r) => {
      const el = document.createElement('div');
      el.className = 'insight-item insight-risk';
      el.innerHTML = `<strong>[RISK]</strong> ${escapeHtml(r.title)}<br/>
        <span class="insight-field">Severity: <b>${r.severity || 'medium'}</b> · Mitigation: <b>${escapeHtml(r.mitigation || 'Monitor closely')}</b> · <b>${r.timestamp || ''}</b></span>`;
      insightList.appendChild(el);
    });

    if (!insights.summary && (!insights.decisions || !insights.decisions.length) && (!insights.actionItems || !insights.actionItems.length) && (!insights.risks || !insights.risks.length)) {
      insightList.innerHTML = `<div style="font-size: 10px; color: #94A3B8; text-align: center; margin: auto;">Listening for key decisions & tasks...</div>`;
    }
  }

  function renderFinalSummaries(finalSummaries) {
    if (!finalSummaries) return;
    const wrap = document.createElement('div');
    wrap.className = 'insight-item insight-summary';
    wrap.innerHTML = `
      <strong>📋 EXECUTIVE SUMMARY</strong><br/><span style="font-size:10px;">${escapeHtml(finalSummaries.executive)}</span><br/><br/>
      <strong>🔧 TECHNICAL SUMMARY</strong><br/><span style="font-size:10px;">${escapeHtml(finalSummaries.technical)}</span><br/><br/>
      <strong>🗒️ MEETING MINUTES</strong><br/><span style="font-size:10px; white-space:pre-wrap;">${escapeHtml(finalSummaries.minutes)}</span>
    `;
    insightList.prepend(wrap);
    insightList.scrollTop = 0;
  }

  // ─── Intel / Chat tab switching ───────────────────────────────────────────
  tabIntelBtn.addEventListener('click', () => {
    activeIntelTab = 'intel';
    tabIntelBtn.classList.add('active');
    tabChatBtn.classList.remove('active');
    insightList.style.display = 'flex';
    chatPanel.classList.remove('active');
    renderInsights(latestInsights);
  });

  tabChatBtn.addEventListener('click', () => {
    activeIntelTab = 'chat';
    tabChatBtn.classList.add('active');
    tabIntelBtn.classList.remove('active');
    insightList.style.display = 'none';
    chatPanel.classList.add('active');
  });

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
    if (res.ok && res.data && res.data.reply) {
      thinkingEl.textContent = res.data.reply;
    } else {
      thinkingEl.textContent = 'Sorry, I could not process that question right now. Please try again in a moment.';
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatSendBtn.disabled = false;
  }

  chatSendBtn.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendChatMessage(); }
  });

  // ─── Speech Recognition Engine (Mic) ───────────────────────────────────────
  let recognitionWatchdog = null;
  let micPermissionDenied = false;

  function startRealSpeechRecognition() {
    if (micPermissionDenied) return null;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    try {
      const instance = new SR();
      instance.continuous = true;
      instance.interimResults = true;
      instance.lang = 'en-US';

      instance.onresult = (event) => {
        if (isPaused) return;
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) finalText += t + ' ';
          else interimText += t;
        }

        const speakerName = (speakerNameInput.value || 'You').trim() || 'You';
        if (interimText.trim()) {
          appendTranscriptLine(speakerName, interimText.trim(), true);
        }
        if (finalText.trim()) {
          appendTranscriptLine(speakerName, finalText.trim(), false);
        }
      };

      instance.onerror = (e) => {
        const errorType = e.error || e.message;
        if (errorType === 'no-speech' || errorType === 'aborted') {
          return; // Expected operational status during silence or restart
        }

        if (errorType === 'not-allowed') {
          micPermissionDenied = true;
          if (recognitionWatchdog) {
            clearInterval(recognitionWatchdog);
            recognitionWatchdog = null;
          }
          appendTranscriptLine('System', '⚠️ Mic permission required for live speech. Capturing video subtitles directly...', false);
          console.log('[Cue Extension] Speech recognition permission denied or unavailable for this origin.');
          return;
        }

        console.log('[Cue Extension] Speech recognition notice:', errorType);
      };

      instance.onend = () => {
        if (recognitionInstance && !isPaused && !micPermissionDenied) {
          setTimeout(() => {
            try {
              if (recognitionInstance) recognitionInstance.start();
            } catch (_) {}
          }, 200);
        }
      };

      try {
        instance.start();
      } catch (startErr) {
        console.log('[Cue Extension] SpeechRecognition start notice:', startErr?.message || startErr);
      }

      // Watchdog timer: automatically restarts recognition if browser stops it silently
      if (recognitionWatchdog) clearInterval(recognitionWatchdog);
      recognitionWatchdog = setInterval(() => {
        if (recognitionInstance && !isPaused && !micPermissionDenied) {
          try { instance.start(); } catch (_) {}
        }
      }, 5000);

      return instance;
    } catch (err) {
      console.log('[Cue Extension] Web Speech API initialization notice:', err?.message || err);
      return null;
    }
  }

  // ─── YouTube & HTML5 Video Subtitle / Spoken Text Sync Engine ─────────────
  // Gated by the underlying <video>'s play/pause state so we stop transcribing
  // when audio stops and resume automatically when it starts again.
  let videoSyncInterval = null;
  let videoAudioActive = true;
  let watchedVideoEl = null;

  function bindVideoPlaybackGate(video) {
    if (!video || watchedVideoEl === video) return;
    watchedVideoEl = video;
    videoAudioActive = !video.paused && !video.ended;
    video.addEventListener('play', () => { videoAudioActive = true; });
    video.addEventListener('pause', () => { videoAudioActive = false; });
    video.addEventListener('ended', () => { videoAudioActive = false; });
    video.addEventListener('waiting', () => { videoAudioActive = false; });
    video.addEventListener('playing', () => { videoAudioActive = true; });
  }

  function startVideoAudioSyncEngine() {
    seenCaptions.clear();
    const video = document.querySelector('video');
    bindVideoPlaybackGate(video);

    // 1. YouTube Subtitle Track Fetching (Support both official & auto-generated ASR captions)
    if (window.location.hostname.includes('youtube.com')) {
      const videoId = new URLSearchParams(window.location.search).get('v');
      if (videoId) {
        const fetchCues = (url) => {
          fetch(url)
            .then(res => res.json())
            .then(data => {
              if (data && data.events) {
                const cues = data.events
                  .filter(e => e.segs && e.segs.length > 0)
                  .map(e => ({
                    start: e.tStartMs / 1000,
                    text: e.segs.map(s => s.utf8).join('').trim()
                  }))
                  .filter(c => c.text && c.text !== '\n');

                if (videoSyncInterval) clearInterval(videoSyncInterval);
                videoSyncInterval = setInterval(() => {
                  if (isPaused || !videoAudioActive || !video) return;
                  const currentTime = video.currentTime;
                  cues.forEach(c => {
                    if (Math.abs(c.start - currentTime) < 1.5 && !seenCaptions.has(c.text)) {
                      seenCaptions.add(c.text);
                      appendTranscriptLine('Video Captions', c.text, false);
                    }
                  });
                }, 400);
              }
            })
            .catch(() => {
              if (!url.includes('kind=asr')) {
                fetchCues(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr&fmt=json3`);
              }
            });
        };

        fetchCues(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`);
      }
    }

    // 2. Native HTML5 Video textTracks API Listener
    if (video && video.textTracks) {
      try {
        for (let i = 0; i < video.textTracks.length; i++) {
          const track = video.textTracks[i];
          track.mode = 'showing';
          track.oncuechange = () => {
            if (isPaused || !videoAudioActive) return;
            const activeCues = track.activeCues;
            if (activeCues) {
              for (let j = 0; j < activeCues.length; j++) {
                const txt = activeCues[j].text?.replace(/<[^>]*>/g, '').trim();
                if (txt && !seenCaptions.has(txt)) {
                  seenCaptions.add(txt);
                  appendTranscriptLine('Video Captions', txt, false);
                }
              }
            }
          };
        }
      } catch (_) {}
    }

    // 3. DOM Subtitle & Caption Element Mutation Observer (Meet/Zoom/Teams/generic)
    const captionContainer = document.querySelector('.ytp-caption-window-container') || document.querySelector('.captions-text') || document.body;
    if (!captionContainer) return null;

    const observer = new MutationObserver(() => {
      if (isPaused || !videoAudioActive) return;
      const segments = document.querySelectorAll('.ytp-caption-segment, .caption-visual-line, .ytp-caption-window-bottom, .caption-text, [class*="caption"], [class*="subtitle"]');
      segments.forEach((seg) => {
        const text = seg.textContent.trim();
        if (text && text.length > 2 && text.length < 500 && !seenCaptions.has(text)) {
          seenCaptions.add(text);
          appendTranscriptLine('Video Captions', text, false);
        }
      });
    });

    observer.observe(captionContainer, { childList: true, subtree: true, characterData: true });
    return observer;
  }

  // ─── Computer/Tab Audio -> Real Whisper Transcription Pipeline ────────────
  // Web Speech API only listens to the default microphone, so tab/system audio
  // (no captions available) is captured via getDisplayMedia + MediaRecorder,
  // decoded/resampled to 16kHz mono WAV client-side (browsers can decode their
  // own recordings; the server has no ffmpeg/webm decoder), and sent to the
  // real Whisper pipeline in small rolling chunks for genuine transcription.
  let tabAudioStream = null;
  let chunkAudioCtx = null;
  let chunkActive = false;
  const CHUNK_DURATION_MS = 7000;
  const SILENCE_RMS_THRESHOLD = 0.008;

  async function startTabAudioTranscription() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const audioTracks = stream.getAudioTracks();
      stream.getVideoTracks().forEach((t) => t.stop());

      if (audioTracks.length === 0) {
        appendTranscriptLine('System', '⚠️ No tab/system audio was shared. Re-select "Computer" and check "Share tab audio" in the picker.', false);
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      tabAudioStream = new MediaStream(audioTracks);
      chunkAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      chunkActive = true;
      runChunkLoop();
    } catch (err) {
      console.log('[Cue Extension] getDisplayMedia notice:', err?.message || err);
      appendTranscriptLine('System', 'Computer audio capture was not started (permission dismissed or unsupported).', false);
    }
  }

  function recordOneChunk(durationMs) {
    return new Promise((resolve) => {
      if (!tabAudioStream) { resolve(null); return; }
      const chunks = [];
      let recorder;
      try {
        recorder = new MediaRecorder(tabAudioStream, { mimeType: 'audio/webm' });
      } catch (e) {
        resolve(null);
        return;
      }
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'audio/webm' }));
      recorder.onerror = () => resolve(null);
      try { recorder.start(); } catch (_) { resolve(null); return; }
      setTimeout(() => {
        if (recorder.state !== 'inactive') {
          try { recorder.stop(); } catch (_) { resolve(null); }
        }
      }, durationMs);
    });
  }

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

  function computeRms(samples) {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    return Math.sqrt(sum / (samples.length || 1));
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

  async function transcribeChunkAndAppend(blob) {
    if (!blob || blob.size < 2000 || !chunkAudioCtx) return;
    try {
      const arrayBuf = await blob.arrayBuffer();
      const decoded = await chunkAudioCtx.decodeAudioData(arrayBuf.slice(0));
      const mono16k = downsampleTo16kMono(decoded);
      if (mono16k.length < 1600) return;

      // Skip near-silence: avoids needless AI processing and Whisper's known
      // tendency to hallucinate captions from silent/low-energy audio.
      if (computeRms(mono16k) < SILENCE_RMS_THRESHOLD) return;

      const wavBuffer = encodeWavPcm16(mono16k, 16000);
      const res = await callApiBinary('/api/transcribe-chunk', wavBuffer);
      const text = res && res.ok && res.data && typeof res.data.text === 'string' ? res.data.text.trim() : '';
      if (text) {
        appendTranscriptLine('Computer Audio', text, false);
      }
    } catch (err) {
      console.log('[Cue Extension] Chunk transcription notice:', err?.message || err);
    }
  }

  async function runChunkLoop() {
    while (chunkActive) {
      if (isPaused) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      const blob = await recordOneChunk(CHUNK_DURATION_MS);
      if (!chunkActive) break;
      await transcribeChunkAndAppend(blob);
    }
  }

  function stopTabAudioTranscription() {
    chunkActive = false;
    if (tabAudioStream) {
      tabAudioStream.getTracks().forEach((t) => t.stop());
      tabAudioStream = null;
    }
    if (chunkAudioCtx) {
      try { chunkAudioCtx.close(); } catch (_) {}
      chunkAudioCtx = null;
    }
  }

  // ─── Start / Pause / Stop ──────────────────────────────────────────────────
  startBtn.addEventListener('click', async () => {
    statusBadge.className = 'status-badge recording';
    statusText.textContent = 'REC';
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    summarizeBtn.style.display = 'inline-block';
    stopBtn.style.display = 'inline-block';
    livePulse.style.display = 'inline';
    transcriptFeed.innerHTML = '';
    lastBlockEl = null;
    lastBlockSpeaker = null;
    lastFinalKey = '';
    insightList.innerHTML = `<div style="font-size: 10px; color: #94A3B8; text-align: center; margin: auto;">Listening for key decisions & tasks...</div>`;
    latestInsights = { summary: '', decisions: [], actionItems: [], risks: [] };

    seconds = 0;
    micPermissionDenied = false;

    const sourceName = selectedAudioSource === 'mic' ? '🎙️ Microphone' : selectedAudioSource === 'comp' ? '💻 Computer Audio' : '🎙️+💻 Both (Mic & Computer)';
    appendTranscriptLine('System', `Recording active [Source: ${sourceName}]`, false);

    ensureLiveMeeting();

    // 1. Microphone Audio Capture (Mic or Both)
    if (selectedAudioSource === 'mic' || selectedAudioSource === 'both') {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(() => {
            recognitionInstance = startRealSpeechRecognition();
          })
          .catch((err) => {
            const errName = err?.name || err?.message || String(err);
            console.log('[Cue Extension] Microphone access notice:', errName);
            recognitionInstance = startRealSpeechRecognition();
          });
      } else {
        recognitionInstance = startRealSpeechRecognition();
      }
    }

    // 2. Computer / Video Audio Capture (Comp or Both)
    if (selectedAudioSource === 'comp' || selectedAudioSource === 'both') {
      captionObserver = startVideoAudioSyncEngine();
      startTabAudioTranscription();
    }

    timerInterval = setInterval(() => {
      if (!isPaused) {
        seconds++;
        timerDisplay.textContent = formatTime(seconds);
      }
    }, 1000);
  });

  pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    if (isPaused) {
      statusText.textContent = 'PAUSED';
      pauseBtn.textContent = '▶';
    } else {
      statusText.textContent = 'REC';
      pauseBtn.textContent = '⏸';
    }
  });

  summarizeBtn.addEventListener('click', async () => {
    summarizeBtn.disabled = true;
    summarizeBtn.textContent = '✨ Summarizing...';
    const id = await ensureLiveMeeting();
    if (id) {
      const res = await callApi(`/api/live-meetings/${id}`, 'PATCH', { action: 'summarize' });
      if (res.ok && res.data && res.data.meeting) {
        if (activeIntelTab === 'intel') {
          renderInsights(res.data.meeting.insights);
          renderFinalSummaries(res.data.meeting.finalSummaries);
        } else {
          latestInsights = res.data.meeting.insights;
        }
      }
    }
    summarizeBtn.disabled = false;
    summarizeBtn.textContent = '✨ Summarize';
  });

  stopBtn.addEventListener('click', async () => {
    clearInterval(timerInterval);
    if (recognitionWatchdog) {
      clearInterval(recognitionWatchdog);
      recognitionWatchdog = null;
    }
    if (videoSyncInterval) {
      clearInterval(videoSyncInterval);
      videoSyncInterval = null;
    }
    if (recognitionInstance) {
      try { recognitionInstance.stop(); } catch (_) {}
      recognitionInstance = null;
    }
    if (captionObserver) {
      try { captionObserver.disconnect(); } catch (_) {}
      captionObserver = null;
    }
    stopTabAudioTranscription();

    statusBadge.className = 'status-badge';
    statusText.textContent = 'PROCESSING...';

    const id = await ensureLiveMeeting();
    if (id) {
      const res = await callApi(`/api/live-meetings/${id}`, 'PATCH', { action: 'end' });
      if (res.ok && res.data && res.data.meeting) {
        renderInsights(res.data.meeting.insights);
        renderFinalSummaries(res.data.meeting.finalSummaries);
      }
    }

    statusText.textContent = 'DONE';
    startBtn.style.display = 'inline-block';
    startBtn.textContent = '▶ New';
    pauseBtn.style.display = 'none';
    summarizeBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    livePulse.style.display = 'none';
  });

  // 9. Export & Workflow Toolbar Handlers (driven by structured backend state,
  // not DOM scraping, so exports stay accurate regardless of how the panel is
  // currently rendered).
  const expEmailBtn = shadow.getElementById('expEmailBtn');
  const expSlackBtn = shadow.getElementById('expSlackBtn');
  const expJiraBtn = shadow.getElementById('expJiraBtn');
  const expStatsBtn = shadow.getElementById('expStatsBtn');

  function getTranscriptLines() {
    return Array.from(transcriptFeed.querySelectorAll('.transcript-block:not(.interim-line)'))
      .map((el) => el.textContent.trim())
      .filter((txt) => txt && !txt.includes('Recording active'));
  }

  expEmailBtn.addEventListener('click', () => {
    const lines = getTranscriptLines();
    if (lines.length === 0) { alert('No meeting data recorded yet to export.'); return; }
    const { decisions, actionItems, risks } = latestInsights;

    const emailContent = `Subject: Executive Meeting Brief - ${new Date().toLocaleDateString()}

Executive Summary:
------------------
${latestInsights.summary || lines.slice(0, 3).join(' ')}

Key Decisions (${decisions.length}):
${decisions.map((d) => `• ${d.title}`).join('\n') || '• None recorded'}

Action Items (${actionItems.length}):
${actionItems.map((t) => `[ ] ${t.title} (Owner: ${t.assignee || 'Unassigned'}${t.dueDate ? `, Due: ${t.dueDate}` : ''})`).join('\n') || '• None recorded'}

Risks Identified (${risks.length}):
${risks.map((r) => `⚠️ ${r.title} (Severity: ${r.severity || 'medium'})`).join('\n') || '• None recorded'}

---
Generated by Cue AI Meeting Intelligence Platform`;

    navigator.clipboard.writeText(emailContent).then(() => {
      appendTranscriptLine('System', '📋 Executive Email Brief copied to clipboard!', false);
    });
  });

  expSlackBtn.addEventListener('click', () => {
    const lines = getTranscriptLines();
    if (lines.length === 0) { alert('No meeting data recorded yet to export.'); return; }
    const { decisions, actionItems, risks } = latestInsights;

    const slackContent = `*:rocket: Meeting Executive Digest* (${new Date().toLocaleTimeString()})

*Summary:* ${latestInsights.summary || lines.slice(0, 2).join(' ')}

*:bullseye: Key Decisions (${decisions.length}):*
${decisions.map((d) => `> • ${d.title}`).join('\n') || '> _None_'}

*:heavy_check_mark: Action Items (${actionItems.length}):*
${actionItems.map((t) => `> • ${t.title} → ${t.assignee || 'Unassigned'}`).join('\n') || '> _None_'}

*:warning: Risks Identified (${risks.length}):*
${risks.map((r) => `> • ${r.title}`).join('\n') || '> _None_'}`;

    navigator.clipboard.writeText(slackContent).then(() => {
      appendTranscriptLine('System', '💬 Slack Digest copied to clipboard!', false);
    });
  });

  expJiraBtn.addEventListener('click', () => {
    const { actionItems } = latestInsights;
    if (!actionItems || actionItems.length === 0) { alert('No action items detected to export.'); return; }

    const jiraContent = actionItems.map((t, idx) => `[TASK-${idx + 1}] Summary: ${t.title} | Assignee: ${t.assignee || 'Unassigned'} | Priority: ${t.priority || 'Medium'} | Due: ${t.dueDate || 'TBD'} | Status: To Do | Created: ${new Date().toISOString().split('T')[0]}`).join('\n');

    navigator.clipboard.writeText(jiraContent).then(() => {
      appendTranscriptLine('System', '🎟️ Jira/GitHub Task list copied to clipboard!', false);
    });
  });

  expStatsBtn.addEventListener('click', () => {
    const lines = getTranscriptLines();
    if (lines.length === 0) { alert('No transcript lines recorded yet for speaker analysis.'); return; }

    const speakerMap = new Map();
    let totalWords = 0;

    Array.from(transcriptFeed.querySelectorAll('.transcript-block:not(.interim-line)')).forEach((block) => {
      const speaker = block.querySelector('.transcript-speaker')?.textContent?.trim() || 'Participant';
      block.querySelectorAll('.utterance-text').forEach((u) => {
        const words = u.textContent.split(/\s+/).filter(Boolean).length;
        speakerMap.set(speaker, (speakerMap.get(speaker) || 0) + words);
        totalWords += words;
      });
    });

    const { decisions, actionItems, risks } = latestInsights;
    const stats = Array.from(speakerMap.entries())
      .map(([name, count]) => ({ name, pct: totalWords > 0 ? Math.round((count / totalWords) * 100) : 0 }))
      .sort((a, b) => b.pct - a.pct);

    const score = Math.min(100, Math.max(50, Math.round(70 + decisions.length * 8 + actionItems.length * 5 - risks.length * 3)));

    const statsCard = document.createElement('div');
    statsCard.className = 'insight-item';
    statsCard.style.background = 'rgba(99, 102, 241, 0.15)';
    statsCard.style.borderLeft = '3px solid #6366F1';
    statsCard.style.color = '#e0e7ff';
    const breakdownHtml = stats.map((s) => `<div>${escapeHtml(s.name)}: ${s.pct}% talk time</div>`).join('');
    statsCard.innerHTML = `<strong>📊 SPEAKER TALK-TIME & EFFICIENCY SCORE (${score}/100)</strong><br/>${breakdownHtml}`;

    if (activeIntelTab !== 'intel') { tabIntelBtn.click(); }
    insightList.prepend(statsCard);
    insightList.scrollTop = 0;
  });

  // 10. Toggle visibility on toolbar icon click
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.action === 'TOGGLE_WIDGET') {
        host.style.display = host.style.display === 'none' ? 'block' : 'none';
        sendResponse({ status: 'ok', visible: host.style.display !== 'none' });
      }
      return true;
    });
  }
})();
