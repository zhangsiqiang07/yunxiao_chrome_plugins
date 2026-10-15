const MSG_TYPE_SNAPSHOT_REQUEST = "YXB_SNAPSHOT_REQUEST";
const MSG_TYPE_NETWORK_BREADCRUMB = "YXB_NETWORK_BREADCRUMB";
const MSG_TYPE_CONSOLE_ERROR = "YXB_CONSOLE_ERROR";
const MAX_ACTIONS = 50;
const MAX_REQUESTS = 20;
const MAX_ERRORS = 10;
const recentActions = [];
const recentRequests = [];
const consoleErrors = [];
function injectScript() {
  try {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("injected.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  } catch (err) {
    console.warn("[YunxiaoBugReporter] 注入脚本失败:", err);
  }
}
injectScript();
window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || typeof event.data !== "object") return;
  const { type, data } = event.data;
  if (type === MSG_TYPE_NETWORK_BREADCRUMB && data) {
    recentRequests.unshift(data);
    if (recentRequests.length > MAX_REQUESTS) {
      recentRequests.pop();
    }
  } else if (type === MSG_TYPE_CONSOLE_ERROR && typeof data === "string") {
    consoleErrors.unshift(data);
    if (consoleErrors.length > MAX_ERRORS) {
      consoleErrors.pop();
    }
  }
});
function trackAction(action) {
  const trimmed = action.trim();
  if (!trimmed) return;
  recentActions.unshift(trimmed);
  if (recentActions.length > MAX_ACTIONS) {
    recentActions.pop();
  }
}
document.addEventListener("click", (event) => {
  try {
    const target = event.target;
    if (!target) return;
    const tag = target.tagName ? target.tagName.toUpperCase() : "ELEMENT";
    let text = (target.innerText || target.getAttribute("title") || target.getAttribute("aria-label") || target.getAttribute("placeholder") || "").trim();
    if (text.length > 50) text = text.slice(0, 50) + "…";
    const idStr = target.id ? `#${target.id}` : "";
    const classStr = target.className && typeof target.className === "string" ? `.${target.className.split(" ").slice(0, 2).join(".")}` : "";
    const selector = `${tag}${idStr}${classStr}`;
    trackAction(`点击 [${selector}] ${text ? `"${text}"` : ""}`);
  } catch {
  }
}, true);
window.addEventListener("popstate", () => {
  trackAction(`路由变化 (popstate): ${window.location.pathname}${window.location.hash}`);
});
window.addEventListener("hashchange", () => {
  trackAction(`路由变化 (hashchange): ${window.location.hash}`);
});
function getBrowserInfo() {
  const ua = navigator.userAgent;
  if (ua.includes("Chrome")) {
    const m = ua.match(/Chrome\/([\d.]+)/);
    return `Chrome ${m ? m[1] : ""}`;
  }
  if (ua.includes("Firefox")) {
    const m = ua.match(/Firefox\/([\d.]+)/);
    return `Firefox ${m ? m[1] : ""}`;
  }
  if (ua.includes("Safari")) {
    const m = ua.match(/Version\/([\d.]+)/);
    return `Safari ${m ? m[1] : ""}`;
  }
  return navigator.userAgent;
}
function getOSInfo() {
  const ua = navigator.userAgent;
  if (ua.includes("Macintosh") || ua.includes("Mac OS")) return "macOS";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  return "Unknown OS";
}
function getNetworkStatus() {
  const conn = navigator.connection;
  if (conn) {
    const type = conn.effectiveType || conn.type || "";
    const rtt = conn.rtt ? `${conn.rtt}ms` : "";
    return [type, rtt, navigator.onLine ? "在线" : "离线"].filter(Boolean).join(" / ");
  }
  return navigator.onLine ? "在线" : "离线";
}
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request && request.type === MSG_TYPE_SNAPSHOT_REQUEST) {
    const snapshot = {
      pageTitle: document.title || "无标题页面",
      pageURL: window.location.href,
      browserInfo: getBrowserInfo(),
      osInfo: getOSInfo(),
      viewportSize: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}x`,
      networkStatus: getNetworkStatus(),
      timestamp: Date.now(),
      recentActions: [...recentActions],
      recentRequests: [...recentRequests],
      consoleErrors: [...consoleErrors],
      supplementaryInfo: {}
    };
    sendResponse({ success: true, data: snapshot });
    return true;
  }
});
