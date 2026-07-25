// Enable side panel on extension icon click
if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.log('[Cue Extension] Side panel setup notice:', error?.message || error));
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Cue Intelligence Chrome Extension Installed');
});

