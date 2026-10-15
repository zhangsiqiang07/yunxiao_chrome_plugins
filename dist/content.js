const MSG_TYPE_SNAPSHOT_REQUEST = "YXB_SNAPSHOT_REQUEST";
const MSG_TYPE_NETWORK_BREADCRUMB = "YXB_NETWORK_BREADCRUMB";
const MSG_TYPE_CONSOLE_ERROR = "YXB_CONSOLE_ERROR";
const MSG_TYPE_CONSOLE_BREADCRUMB = "YXB_CONSOLE_BREADCRUMB";
const MAX_ACTIONS = 50;
const MAX_REQUESTS = 30;
const MAX_ERRORS = 20;
const recentActions = [];
const recentRequests = [];
const consoleErrors = [];
const consoleBreadcrumbs = [];
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
  }
  if (type === MSG_TYPE_CONSOLE_BREADCRUMB && data) {
    const crumb = data;
    consoleBreadcrumbs.unshift(crumb);
    if (consoleBreadcrumbs.length > MAX_ERRORS) {
      consoleBreadcrumbs.pop();
    }
    if (crumb.level === "error") {
      const summary = crumb.stack ? `${crumb.message}
  ${crumb.stack.split("\n").slice(1, 4).join("\n  ")}` : crumb.message;
      consoleErrors.unshift(summary);
      if (consoleErrors.length > MAX_ERRORS) {
        consoleErrors.pop();
      }
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
  const timeStr = (/* @__PURE__ */ new Date()).toTimeString().split(" ")[0];
  recentActions.unshift(`[${timeStr}] ${trimmed}`);
  if (recentActions.length > MAX_ACTIONS) {
    recentActions.pop();
  }
}
function getElementDescriptor(el) {
  const tag = el.tagName ? el.tagName.toLowerCase() : "element";
  const testId = el.getAttribute("data-testid") || el.getAttribute("data-test");
  if (testId) return `${tag}[data-testid="${testId}"]`;
  if (el.id) return `${tag}#${el.id}`;
  if (el.className && typeof el.className === "string") {
    const cls = el.className.split(" ").filter((c) => c && !c.includes(":")).slice(0, 2).join(".");
    if (cls) return `${tag}.${cls}`;
  }
  return tag;
}
document.addEventListener("click", (event) => {
  try {
    const target = event.target;
    if (!target) return;
    const desc = getElementDescriptor(target);
    let text = (target.innerText || target.getAttribute("title") || target.getAttribute("aria-label") || target.getAttribute("placeholder") || "").trim();
    if (text.length > 40) text = text.slice(0, 40) + "…";
    trackAction(`点击 <${desc}> ${text ? `"${text}"` : ""}`);
  } catch {
  }
}, true);
document.addEventListener("change", (event) => {
  try {
    const target = event.target;
    if (!target) return;
    const tag = target.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") {
      const type = target.type || "";
      const name = target.name || target.id || target.getAttribute("placeholder") || "";
      trackAction(`更改表单 <${tag}${type ? `:${type}` : ""}> ${name ? `[${name}]` : ""}`);
    }
  } catch {
  }
}, true);
document.addEventListener("keydown", (event) => {
  try {
    if (event.key === "Enter" || event.key === "Escape" || event.key === "Tab") {
      const target = event.target;
      const desc = target ? getElementDescriptor(target) : "body";
      trackAction(`按键 [${event.key}] on <${desc}>`);
    }
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
function getPerformanceMetrics() {
  const metrics = {};
  try {
    const mem = performance.memory;
    if (mem) {
      metrics.jsHeapUsedMb = Math.round(mem.usedJSHeapSize / (1024 * 1024) * 10) / 10;
      metrics.jsHeapTotalMb = Math.round(mem.totalJSHeapSize / (1024 * 1024) * 10) / 10;
    }
    const navEntries = performance.getEntriesByType("navigation");
    if (navEntries && navEntries.length > 0) {
      const nav = navEntries[0];
      if (nav.domainLookupEnd > 0) metrics.dnsMs = Math.round(nav.domainLookupEnd - nav.domainLookupStart);
      if (nav.responseStart > 0) metrics.ttfbMs = Math.round(nav.responseStart - nav.requestStart);
      if (nav.domContentLoadedEventEnd > 0) metrics.domContentLoadedMs = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
      if (nav.loadEventEnd > 0) metrics.pageLoadMs = Math.round(nav.loadEventEnd - nav.startTime);
    } else if (performance.timing) {
      const t = performance.timing;
      const start = t.navigationStart;
      if (t.domainLookupEnd > 0) metrics.dnsMs = Math.max(0, t.domainLookupEnd - t.domainLookupStart);
      if (t.responseStart > 0) metrics.ttfbMs = Math.max(0, t.responseStart - t.requestStart);
      if (t.domContentLoadedEventEnd > 0) metrics.domContentLoadedMs = Math.max(0, t.domContentLoadedEventEnd - start);
      if (t.loadEventEnd > 0) metrics.pageLoadMs = Math.max(0, t.loadEventEnd - start);
    }
  } catch {
  }
  return metrics;
}
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request && request.type === MSG_TYPE_SNAPSHOT_REQUEST) {
    const failedRequests = recentRequests.filter((r) => r.isFailed);
    const errorCount = consoleBreadcrumbs.filter((c) => c.level === "error").length || consoleErrors.length;
    const snapshot = {
      pageTitle: document.title || "无标题页面",
      pageURL: window.location.href,
      browserInfo: getBrowserInfo(),
      osInfo: getOSInfo(),
      viewportSize: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}x`,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      colorScheme: window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light",
      networkStatus: getNetworkStatus(),
      timestamp: Date.now(),
      recentActions: [...recentActions],
      recentRequests: [...recentRequests],
      consoleErrors: [...consoleErrors],
      consoleBreadcrumbs: [...consoleBreadcrumbs],
      performanceMetrics: getPerformanceMetrics(),
      diagnostics: {
        failedRequestCount: failedRequests.length,
        errorCount
      },
      supplementaryInfo: {}
    };
    sendResponse({ success: true, data: snapshot });
    return true;
  }
});
