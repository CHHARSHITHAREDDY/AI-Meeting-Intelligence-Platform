document.getElementById('toggleOverlay')?.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) { window.close(); return; }

    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:'))) {
      alert('Floating widget cannot be injected into browser internal pages (chrome://, etc.). Please test on a regular web page (e.g. google.com or http://localhost:3000).');
      window.close();
      return;
    }

    // Step 1: Try to show existing widget directly via inline function (no message passing race condition)
    let results;
    try {
      results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const host = document.getElementById('weave-widget-host');
          if (host) {
            host.style.display = 'block';
            return true; // widget already existed and is now shown
          }
          return false; // widget not yet injected
        }
      });
    } catch (_) {
      results = null;
    }

    const alreadyExists = results && results[0] && results[0].result === true;

    // Step 2: If widget didn't exist yet, inject the full content.js which creates it
    if (!alreadyExists) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (err) {
        console.log('[Popup] Script injection notice:', err?.message || err);
      }
    }
  } catch (err) {
    console.log('[Popup] Toggle overlay error:', err?.message || err);
  }
  window.close();
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
