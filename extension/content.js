(function () {
  if (document.getElementById('cue-widget-host')) return;

  // 1. Create Host Element & Shadow DOM
  const host = document.createElement('div');
  host.id = 'cue-widget-host';
  host.style.position = 'fixed';
  host.style.top = '20px';
  host.style.right = '20px';
  host.style.zIndex = '2147483647';
  host.style.width = '380px';
  host.style.height = '500px';
  host.style.minWidth = '190px';
  host.style.minHeight = '65px';
  host.style.resize = 'both';
  host.style.overflow = 'hidden';
  host.style.borderRadius = '14px';
  host.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(99, 102, 241, 0.3)';

  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

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
    }

    .transcript-feed {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      user-select: text;
    }

    .transcript-line {
      font-size: 11px;
      line-height: 1.4;
      color: #dfe2ef;
      background: rgba(24, 27, 37, 0.7);
      padding: 6px 8px;
      border-radius: 6px;
      border-left: 3px solid #6366F1;
    }

    .speaker { font-weight: 700; color: #c0c1ff; margin-right: 4px; }

    /* Insights Section */
    .insights-section {
      padding: 10px 12px;
      height: 140px;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      overflow: hidden;
    }

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
      line-height: 1.3;
    }

    .insight-decision { background: rgba(52, 211, 153, 0.08); border-left: 3px solid #34D399; color: #a7f3d0; }
    .insight-task { background: rgba(192, 193, 255, 0.08); border-left: 3px solid #c0c1ff; color: #e0e7ff; }
    .insight-risk { background: rgba(255, 180, 171, 0.08); border-left: 3px solid #ffb4ab; color: #fecdd3; }

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
      <span id="timerDisplay" class="timer-display">00:00:00</span>
      <div style="display: flex; gap: 6px;">
        <button id="startBtn" class="btn-record">▶ Start</button>
        <button id="pauseBtn" class="btn-icon" style="display:none;">⏸</button>
        <button id="stopBtn" class="btn-icon btn-stop" style="display:none;">⏹ Stop</button>
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
      </div>
      <div id="insightList" class="insight-list">
        <div style="font-size: 10px; color: #94A3B8; text-align: center; margin: auto;">
          Listening for key decisions & tasks...
        </div>
      </div>
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
  const statusBadge = shadow.getElementById('statusBadge');
  const statusText = shadow.getElementById('statusText');
  const timerDisplay = shadow.getElementById('timerDisplay');
  const transcriptFeed = shadow.getElementById('transcriptFeed');
  const insightList = shadow.getElementById('insightList');
  const livePulse = shadow.getElementById('livePulse');

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

  // 7. Recorder Engine
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

  function appendTranscriptLine(speaker, text, isInterim = false) {
    if (!text.trim()) return;
    
    // Remove placeholder message if present
    if (transcriptFeed.querySelector('div')?.textContent.includes('Click ▶ Start')) {
      transcriptFeed.innerHTML = '';
    }

    let interimEl = transcriptFeed.querySelector('.interim-line');
    if (isInterim) {
      if (!interimEl) {
        interimEl = document.createElement('div');
        interimEl.className = 'transcript-line interim-line';
        interimEl.style.opacity = '0.7';
        interimEl.style.fontStyle = 'italic';
        interimEl.style.borderLeftColor = '#a5b4fc';
        transcriptFeed.appendChild(interimEl);
      }
      interimEl.innerHTML = `<span class="speaker">${speaker} (speaking...):</span> ${text}`;
      transcriptFeed.scrollTop = transcriptFeed.scrollHeight;
      return;
    }

    if (interimEl) interimEl.remove();

    const div = document.createElement('div');
    div.className = 'transcript-line';
    div.innerHTML = `<span class="speaker">${speaker}:</span> ${text}`;
    transcriptFeed.appendChild(div);
    transcriptFeed.scrollTop = transcriptFeed.scrollHeight;

    // Real-time keyword intelligence detector
    const lower = text.toLowerCase();
    if (lower.includes('decid') || lower.includes('agree') || lower.includes('will cap') || lower.includes('approved')) {
      addInsight('insight-decision', 'DECISION', text);
    } else if (lower.includes('action') || lower.includes('todo') || lower.includes('will update') || lower.includes('assigned')) {
      addInsight('insight-task', 'TASK', text);
    } else if (lower.includes('risk') || lower.includes('worry') || lower.includes('latency') || lower.includes('issue')) {
      addInsight('insight-risk', 'RISK', text);
    }
  }

  function startRealSpeechRecognition() {
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

        if (interimText.trim()) {
          appendTranscriptLine('Audio Input', interimText.trim(), true);
        }
        if (finalText.trim()) {
          appendTranscriptLine('Audio Input', finalText.trim(), false);
        }
      };

      instance.onerror = (e) => {
        console.warn('[Cue Extension] Speech recognition notice:', e.error);
        if (e.error === 'not-allowed') {
          appendTranscriptLine('System', '⚠️ Mic permission needed for live voice. Capturing video subtitles directly...', false);
        }
      };

      instance.onend = () => {
        if (recognitionInstance && !isPaused) {
          try { recognitionInstance.start(); } catch (_) {}
        }
      };

      instance.start();
      return instance;
    } catch (err) {
      console.warn('[Cue Extension] Web Speech API initialization notice:', err);
      return null;
    }
  }

  // YouTube & HTML5 Video Subtitle / Spoken Text Sync Engine
  let videoSyncInterval = null;

  function startVideoAudioSyncEngine() {
    seenCaptions.clear();
    const video = document.querySelector('video');

    // 1. YouTube Subtitle Track Fetching (if on YouTube)
    if (window.location.hostname.includes('youtube.com')) {
      const videoId = new URLSearchParams(window.location.search).get('v');
      if (videoId) {
        fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`)
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
                if (isPaused || !video) return;
                const currentTime = video.currentTime;
                cues.forEach(c => {
                  if (Math.abs(c.start - currentTime) < 1.2 && !seenCaptions.has(c.text)) {
                    seenCaptions.add(c.text);
                    appendTranscriptLine('YouTube Video Spoken', c.text, false);
                  }
                });
              }, 500);
            }
          })
          .catch(() => { /* silent fallback to DOM observer */ });
      }
    }

    // 2. DOM Subtitle & TextTrack Observer
    const captionContainer = document.querySelector('.ytp-caption-window-container') || document.querySelector('.captions-text') || document.body;
    if (!captionContainer) return null;

    const observer = new MutationObserver(() => {
      if (isPaused) return;
      const segments = document.querySelectorAll('.ytp-caption-segment, .caption-visual-line, .ytp-caption-window-bottom');
      segments.forEach((seg) => {
        const text = seg.textContent.trim();
        if (text && text.length > 2 && !seenCaptions.has(text)) {
          seenCaptions.add(text);
          appendTranscriptLine('Video Spoken', text, false);
        }
      });
    });

    observer.observe(captionContainer, { childList: true, subtree: true, characterData: true });
    return observer;
  }

  startBtn.addEventListener('click', () => {
    statusBadge.className = 'status-badge recording';
    statusText.textContent = 'REC';
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    stopBtn.style.display = 'inline-block';
    livePulse.style.display = 'inline';
    transcriptFeed.innerHTML = '';

    seconds = 0;
    // Prompt microphone access if needed and start engines
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          recognitionInstance = startRealSpeechRecognition();
        })
        .catch((err) => {
          console.warn('[Cue Extension] Microphone access error:', err);
          recognitionInstance = startRealSpeechRecognition();
        });
    } else {
      recognitionInstance = startRealSpeechRecognition();
    }

    captionObserver = startVideoAudioSyncEngine();

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

  stopBtn.addEventListener('click', () => {
    clearInterval(timerInterval);
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

    statusBadge.className = 'status-badge';
    statusText.textContent = 'DONE';
    startBtn.style.display = 'inline-block';
    startBtn.textContent = '▶ New';
    pauseBtn.style.display = 'none';
    stopBtn.style.display = 'none';
    livePulse.style.display = 'none';
  });

  function addInsight(cls, tag, txt) {
    if (insightList.children[0]?.textContent.includes('Listening')) {
      insightList.innerHTML = '';
    }
    const el = document.createElement('div');
    el.className = `insight-item ${cls}`;
    el.innerHTML = `<strong>[${tag}]</strong> ${txt}`;
    insightList.appendChild(el);
  }

})();
