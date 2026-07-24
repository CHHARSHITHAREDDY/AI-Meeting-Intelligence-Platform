document.getElementById('openSidePanel')?.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

document.getElementById('openDashboard')?.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
});
