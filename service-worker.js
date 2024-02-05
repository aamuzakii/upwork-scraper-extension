function reddenPage() {
  document.body.style.backgroundColor = "blue";
  fetch("http://localhost:3000/api/log/0000000000000");
}

chrome.action.onClicked.addListener((tab) => {
  if (!tab.url.includes("chrome://")) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: reddenPage,
    });
  }
});
