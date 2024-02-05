function reddenPage() {
  document.body.style.backgroundColor = 'blue';
  chrome.action.setBadgeText({
    text: "OFF",
  });
}

chrome.action.onClicked.addListener((tab) => {
  if (!tab.url.includes('chrome://')) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: reddenPage
    });
  }
});
