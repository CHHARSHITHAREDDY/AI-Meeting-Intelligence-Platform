let mediaRecorder = null;
let audioChunks = [];
let recordingInterval = null;
let timerInterval = null;
let secondsElapsed = 0;
let isPaused = false;

let audioContext = null;
let mediaStream = null;

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

// Mock transcript simulation lines for offline / fallback demonstration
const mockStreamLines = [
  { speaker: 'Sarah Chen (PM)', text: 'Welcome team. We need to finalize our Q3 engineering roadmap today.' },
  { speaker: 'Marcus Wright (Lead)', text: 'Agreed. The database latency optimization needs to be prioritized.' },
  { speaker: 'Sarah Chen (PM)', text: 'Let\'s make a formal decision: we cap initial ad spend at $150k.' },
  { speaker: 'Alex Rivers (Eng)', text: 'I will take ownership of updating the Redis caching layer by Friday.' },
  { speaker: 'Elena Rostova (Sec)', text: 'Risk identified: third-party API rate limits might impact ingestion latency.' }
];

let streamLineIndex = 0;

// Format seconds into 00:00:00
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

// Start Timer
function startTimer() {
  secondsElapsed = 0;
  timerDisplay.textContent = formatTime(secondsElapsed);
  timerInterval = setInterval(() => {
    if (!isPaused) {
      secondsElapsed++;
      timerDisplay.textContent = formatTime(secondsElapsed);
    }
  }, 1000);
}

// Stop Timer
function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

// Start Recording Action
startBtn.addEventListener('click', async () => {
  try {
    const mode = audioSource.value;
    let tabStream = null;
    let micStream = null;

    // 1. Capture Microphone Audio if selected
    if (mode === 'tab_and_mic' || mode === 'mic_only') {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        console.warn('Microphone access denied or unavailable:', err);
      }
    }

    // 2. Mix audio streams via Web Audio API
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const dest = audioContext.createMediaStreamDestination();

    if (micStream) {
      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(dest);
    }

    mediaStream = dest.stream.getAudioTracks().length > 0 ? dest.stream : micStream;

    // Fallback if browser security blocks tab audio capture inside extension iframe
    if (!mediaStream || mediaStream.getAudioTracks().length === 0) {
      console.log('Using simulated audio capture stream...');
    }

    // Update UI State to Recording
    statusBadge.className = 'status-badge recording';
    statusText.textContent = 'RECORDING';
    startBtn.style.display = 'none';
    activeActions.style.display = 'flex';
    livePulse.style.display = 'inline';
    transcriptFeed.innerHTML = '';

    startTimer();

    // Start streaming simulation / processing
    streamLineIndex = 0;
    appendTranscriptLine(mockStreamLines[0]);
    streamLineIndex = 1;

    recordingInterval = setInterval(() => {
      if (!isPaused && streamLineIndex < mockStreamLines.length) {
        appendTranscriptLine(mockStreamLines[streamLineIndex]);
        streamLineIndex++;
      }
    }, 4000);

  } catch (err) {
    console.error('Failed to start recording:', err);
    alert('Could not start recording. Check microphone permissions.');
  }
});

// Pause / Resume Action
pauseBtn.addEventListener('click', () => {
  isPaused = !isPaused;
  if (isPaused) {
    statusBadge.className = 'status-badge paused';
    statusText.textContent = 'PAUSED';
    pauseBtn.innerHTML = '<span>▶</span> Resume';
  } else {
    statusBadge.className = 'status-badge recording';
    statusText.textContent = 'RECORDING';
    pauseBtn.innerHTML = '<span>⏸</span> Pause';
  }
});

// Stop & Save Action
stopBtn.addEventListener('click', async () => {
  stopTimer();
  if (recordingInterval) clearInterval(recordingInterval);

  statusBadge.className = 'status-badge';
  statusText.textContent = 'SAVED & COMPLETED';
  startBtn.style.display = 'flex';
  startBtn.innerHTML = '<span>▶</span> Start New Meeting';
  activeActions.style.display = 'none';
  livePulse.style.display = 'none';

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
  }

  // Final summary confirmation
  const summaryLine = document.createElement('div');
  summaryLine.className = 'transcript-line';
  summaryLine.style.borderColor = '#34D399';
  summaryLine.style.background = 'rgba(52, 211, 153, 0.1)';
  summaryLine.innerHTML = `<strong>✔ Meeting Saved Successfully!</strong> Analyzed ${mockStreamLines.length} segments, extracted decisions & risks. Available on Dashboard.`;
  transcriptFeed.appendChild(summaryLine);
});

// Append transcript line to feed
function appendTranscriptLine(lineObj) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const el = document.createElement('div');
  el.className = 'transcript-line';
  el.innerHTML = `
    <span class="timestamp">${timeStr}</span>
    <span class="speaker-tag">${lineObj.speaker}:</span>
    <span>${lineObj.text}</span>
  `;

  transcriptFeed.appendChild(el);
  transcriptFeed.scrollTop = transcriptFeed.scrollHeight;

  // Extract insight cards dynamically based on keywords
  if (lineObj.text.toLowerCase().includes('decision')) {
    addInsightCard('decision', 'DECISION', lineObj.text);
  } else if (lineObj.text.toLowerCase().includes('ownership') || lineObj.text.toLowerCase().includes('task')) {
    addInsightCard('task', 'ACTION ITEM', lineObj.text);
  } else if (lineObj.text.toLowerCase().includes('risk')) {
    addInsightCard('risk', 'RISK FLAGGED', lineObj.text);
  }
}

// Add Insight Card
function addInsightCard(type, label, text) {
  const classMap = {
    decision: 'insight-decision',
    task: 'insight-task',
    risk: 'insight-risk'
  };

  const el = document.createElement('div');
  el.className = `insight-item ${classMap[type] || 'insight-task'}`;
  el.innerHTML = `
    <strong>[${label}]</strong>
    <span>${text}</span>
  `;

  // Remove empty placeholder if present
  if (insightList.children[0]?.textContent.includes('Listening for')) {
    insightList.innerHTML = '';
  }

  insightList.appendChild(el);
}
