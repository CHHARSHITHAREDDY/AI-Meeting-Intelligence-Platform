document.getElementById('toggleOverlay')?.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:'))) {
      alert('Floating widget cannot be injected into browser internal pages (chrome://, etc.). Please test on a regular web page (e.g. google.com or http://localhost:3000).');
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_WIDGET' }, async (response) => {
      if (chrome.runtime.lastError || !response) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
        } catch (err) {
          console.log('[Popup] Script injection notice:', err?.message || err);
        }
      }
      window.close();
    });
  } catch (err) {
    console.log('[Popup] Toggle overlay error:', err?.message || err);
  }
});

document.getElementById('openDashboard')?.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
});

