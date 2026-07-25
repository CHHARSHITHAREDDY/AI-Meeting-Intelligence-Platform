// Enable side panel on extension icon click
if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
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

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
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

  // CUE_API_BINARY: used for the audio-chunk transcription pipeline. The
  // content script decodes/resamples audio to a 16kHz mono WAV ArrayBuffer
  // client-side (browsers can decode their own MediaRecorder output; the
  // server has no ffmpeg/webm decoder), base64-encodes it for message-passing,
  // and we forward the raw bytes to the backend as application/octet-stream.
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
