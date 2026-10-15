import {
  MSG_TYPE_CAPTURE_SCREENSHOT,
  MSG_TYPE_SNAPSHOT_REQUEST,
} from '../collector/types';

// 点击扩展图标打开侧边栏
chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true })?.catch?.(() => {});

// 监听快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'capture-and-report') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.windowId) return;

    try {
      // 1. 网页截图
      const screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

      // 2. 获取当前页面上下文快照
      let snapshotData = null;
      try {
        const resp = await chrome.tabs.sendMessage(tab.id, { type: MSG_TYPE_SNAPSHOT_REQUEST });
        if (resp && resp.success) {
          snapshotData = resp.data;
        }
      } catch {}

      // 3. 存入 session 存储
      await chrome.storage.session.set({
        pendingBugReport: {
          screenshot: screenshotUrl,
          snapshot: snapshotData,
          timestamp: Date.now(),
        },
      });

      // 4. 打开侧边栏
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (err) {
      console.warn('[YunxiaoBugReporter] 快捷截屏提 Bug 失败:', err);
    }
  }
});

// 处理来自 Side Panel 的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  if (message.type === MSG_TYPE_CAPTURE_SCREENSHOT) {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab || !tab.windowId) {
        sendResponse({ success: false, error: '未找到当前活动标签页' });
        return;
      }
      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
        .then(dataUrl => sendResponse({ success: true, dataUrl }))
        .catch(err => sendResponse({ success: false, error: String(err) }));
    });
    return true; // 异步响应
  }

  if (message.type === MSG_TYPE_SNAPSHOT_REQUEST) {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab || !tab.id) {
        sendResponse({ success: false, error: '未找到当前活动标签页' });
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: MSG_TYPE_SNAPSHOT_REQUEST })
        .then(resp => sendResponse(resp))
        .catch(err => sendResponse({ success: false, error: String(err) }));
    });
    return true; // 异步响应
  }

  return false;
});
