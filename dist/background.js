import { M as MSG_TYPE_SNAPSHOT_REQUEST, a as MSG_TYPE_CAPTURE_SCREENSHOT } from './assets/types-BSSYQL-M.js';

chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true })?.catch?.(() => {
});
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "capture-and-report") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.windowId) return;
    try {
      const screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
      let snapshotData = null;
      try {
        const resp = await chrome.tabs.sendMessage(tab.id, { type: MSG_TYPE_SNAPSHOT_REQUEST });
        if (resp && resp.success) {
          snapshotData = resp.data;
        }
      } catch {
      }
      await chrome.storage.session.set({
        pendingBugReport: {
          screenshot: screenshotUrl,
          snapshot: snapshotData,
          timestamp: Date.now()
        }
      });
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (err) {
      console.warn("[YunxiaoBugReporter] 快捷截屏提 Bug 失败:", err);
    }
  }
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return false;
  if (message.type === MSG_TYPE_CAPTURE_SCREENSHOT) {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab || !tab.windowId) {
        sendResponse({ success: false, error: "未找到当前活动标签页" });
        return;
      }
      chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }).then((dataUrl) => sendResponse({ success: true, dataUrl })).catch((err) => sendResponse({ success: false, error: String(err) }));
    });
    return true;
  }
  if (message.type === MSG_TYPE_SNAPSHOT_REQUEST) {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab || !tab.id) {
        sendResponse({ success: false, error: "未找到当前活动标签页" });
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: MSG_TYPE_SNAPSHOT_REQUEST }).then((resp) => sendResponse(resp)).catch((err) => sendResponse({ success: false, error: String(err) }));
    });
    return true;
  }
  return false;
});
