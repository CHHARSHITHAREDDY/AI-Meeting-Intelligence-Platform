document.getElementById('toggleOverlay')?.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:'))) {
      alert('Floating widget cannot be injected into browser internal pages (chrome://, etc.). Please test on a regular web page (e.g. google.com or http://localhost:3000).');
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (err) {
      console.log('[Popup] Script execution notice:', err?.message || err);
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_WIDGET' });
      } catch (_) {}
    }
  } catch (err) {
    console.log('[Popup] Toggle overlay error:', err?.message || err);
  } finally {
    window.close();
  }
});

document.getElementById('openDashboard')?.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
});

// ─── Join a meeting by link ────────────────────────────────────────────────
// There's no real "bot" here — Chrome extensions can't autonomously navigate
// and click "ask to join" on someone else's Google Meet without a human
// present. Instead: open the link in a new tab, let the user go through the
// normal admit flow, and pre-arm the floating assistant (auto-show it) on
// that tab so it's already sitting there ready — the moment they're
// admitted, they just hit ▶ Start and the existing capture/transcript/
// summary pipeline takes over exactly as it does on any other tab.
async function handleJoinMeeting() {
  const input = document.getElementById('meetLinkInput');
  const raw = (input?.value || '').trim();
  if (!raw) return;

  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const tab = await chrome.tabs.create({ url, active: true });
    if (tab?.id) {
      const targetTabId = tab.id;
      const onUpdated = (tabId, info) => {
        if (tabId !== targetTabId || info.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        // Meet's own UI takes a moment to render past "complete" (heavy SPA),
        // so give it a beat before showing the widget on top of it.
        setTimeout(() => {
          chrome.tabs.sendMessage(targetTabId, { action: 'SHOW_WIDGET' }, () => void chrome.runtime.lastError);
        }, 1500);
      };
      chrome.tabs.onUpdated.addListener(onUpdated);
    }
  } catch (err) {
    console.log('[Popup] Join meeting error:', err?.message || err);
  }
  window.close();
}

document.getElementById('joinMeetingBtn')?.addEventListener('click', () => void handleJoinMeeting());
document.getElementById('meetLinkInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    void handleJoinMeeting();
  }
});
