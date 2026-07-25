// Disable auto-opening side panel on extension icon click so action opens popup/widget (Image 2)
if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch((error) => console.log('[Weave Extension] Side panel setup notice:', error?.message || error));
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Weave Chrome Extension Installed');
});

// ─── Backend API Relay ───────────────────────────────────────────────────────
// Content scripts run inside the page they're injected into, so a direct
// fetch() from content.js to the (http://localhost) backend can be blocked by
// the page's mixed-content policy when the tab is https:// (Google Meet, Zoom
// Web, Teams Web, YouTube, ...). The background service worker has its own
// extension-privileged context (not the page's), so requests made from here
// are not subject to that restriction and — combined with the host_permissions
// declared in manifest.json — also bypass CORS. All content-script network
// calls to our own backend are relayed through this single message handler.
const CUE_BACKEND_URL = 'http://localhost:3000';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.type === 'GET_TAB_AUDIO_STREAM_ID') {
    const targetTabId = sender?.tab?.id || request.tabId;
    if (chrome.tabCapture && typeof chrome.tabCapture.getMediaStreamId === 'function') {
      try {
        // consumerTabId must equal the tab that will call getUserMedia with this streamId
        const options = targetTabId ? { targetTabId, consumerTabId: targetTabId } : {};
        chrome.tabCapture.getMediaStreamId(options, (streamId) => {
          if (chrome.runtime.lastError || !streamId) {
            sendResponse({ ok: false, error: chrome.runtime.lastError?.message || 'No stream ID' });
          } else {
            sendResponse({ ok: true, streamId });
          }
        });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    } else {
      sendResponse({ ok: false, error: 'tabCapture API not available' });
    }
    return true;
  }

  if (!request || (request.type !== 'CUE_API' && request.type !== 'CUE_API_BINARY')) {
    return undefined;
  }

  if (request.type === 'CUE_API') {
    const { path, method, body } = request;
    (async () => {
      try {
        const res = await fetch(`${CUE_BACKEND_URL}${path}`, {
          method: method || 'GET',
          headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        let data = null;
        try {
          data = await res.json();
        } catch (_) {
          // Non-JSON or empty response body is fine for some endpoints.
        }

        sendResponse({ ok: res.ok, status: res.status, data });
      } catch (err) {
        sendResponse({ ok: false, status: 0, error: err?.message || String(err) });
      }
    })();

    return true; // Keep the message channel open for the async sendResponse above.
  }

  // CUE_API_BINARY: used for the audio-chunk transcription pipeline.
  const { path, base64 } = request;
  (async () => {
    try {
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      const res = await fetch(`${CUE_BACKEND_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: bytes,
      });

      let data = null;
      try {
        data = await res.json();
      } catch (_) {}

      sendResponse({ ok: res.ok, status: res.status, data });
    } catch (err) {
      sendResponse({ ok: false, status: 0, error: err?.message || String(err) });
    }
  })();

  return true;
});
