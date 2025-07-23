let scrapedData = [];

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    if (tab.url && tab.url.includes('https://bws.com.au/beer/craft-beer')) {
      chrome.storage.local.remove(['links', 'currentLinkIndex', 'navigationTabId', 'scrapedData']);
      scrapedData = [];
      chrome.action.setPopup({ tabId: tabId, popup: 'popup.html' });
    } else if (tab.url && tab.url.includes('https://bws.com.au/product/')) {
      setTimeout(() => {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['scrape-details.js']
        });
      }, 10000); // Wait 10 seconds
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "navigate_links") {
    scrapedData = []; // Clear data on new navigation
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.storage.local.get('links', (data) => {
          if (data.links && data.links.length > 0) {
            chrome.storage.local.set({ 'currentLinkIndex': 0, 'navigationTabId': tabs[0].id }, () => {
              navigateToNextLink();
            });
          }
        });
      }
    });
  } else if (request.action === "scraped_data") {
    scrapedData.push(request.data);
    chrome.storage.local.set({ scrapedData: scrapedData }, () => {
      chrome.runtime.sendMessage({ action: "data_updated" }, (response) => {
        if (chrome.runtime.lastError) {
          // Silently ignore the error, which is expected if the popup is not open.
        }
      });
    });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "navigateNext") {
    navigateToNextLink();
  }
});

function navigateToNextLink() {
  chrome.storage.local.get(['links', 'currentLinkIndex', 'navigationTabId'], (data) => {
    if (data.links && data.navigationTabId && data.currentLinkIndex < data.links.length) {
      const url = `https://bws.com.au${data.links[data.currentLinkIndex]}`;
      chrome.tabs.update(data.navigationTabId, { url: url });
      chrome.storage.local.set({ 'currentLinkIndex': data.currentLinkIndex + 1 }, () => {
        // chrome.alarms.create("navigateNext", { delayInMinutes: 1 / 3 }); // 20 seconds
        chrome.alarms.create("navigateNext", { delayInMinutes: 1 / 6 }); // 20 seconds
        // chrome.alarms.create("navigateNext", { delayInMinutes: 0.1667 }); // 10 seconds
      });
    } else {
      chrome.storage.local.remove(['currentLinkIndex', 'navigationTabId']);
    }
  });
} 