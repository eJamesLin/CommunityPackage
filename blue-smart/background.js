// background.js - Service worker for action button click
chrome.action.onClicked.addListener((tab) => {
  if (tab.url?.includes("kingnetsmart.com.tw/community/postalList.aspx")) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  }
});
