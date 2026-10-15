import type {
  ConsoleBreadcrumb,
  HostContextSnapshot,
  NetworkBreadcrumb,
  PerformanceMetrics,
} from './types';

// 常量定义
const MSG_TYPE_SNAPSHOT_REQUEST = 'YXB_SNAPSHOT_REQUEST';
const MSG_TYPE_NETWORK_BREADCRUMB = 'YXB_NETWORK_BREADCRUMB';
const MSG_TYPE_CONSOLE_ERROR = 'YXB_CONSOLE_ERROR';
const MSG_TYPE_CONSOLE_BREADCRUMB = 'YXB_CONSOLE_BREADCRUMB';

// 内存环形缓冲区上限
const MAX_ACTIONS = 50;
const MAX_REQUESTS = 30;
const MAX_ERRORS = 20;

const recentActions: string[] = [];
const recentRequests: NetworkBreadcrumb[] = [];
const consoleErrors: string[] = [];
const consoleBreadcrumbs: ConsoleBreadcrumb[] = [];

// 1. 注入 injected.js 到宿主页面 MAIN world
function injectScript() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  } catch (err) {
    console.warn('[YunxiaoBugReporter] 注入脚本失败:', err);
  }
}

injectScript();

// 2. 接收来自 injected.js 的消息
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || typeof event.data !== 'object') return;

  const { type, data } = event.data;

  // 网络请求面包屑
  if (type === MSG_TYPE_NETWORK_BREADCRUMB && data) {
    recentRequests.unshift(data as NetworkBreadcrumb);
    if (recentRequests.length > MAX_REQUESTS) {
      recentRequests.pop();
    }
  }

  // 控制台详细报错
  if (type === MSG_TYPE_CONSOLE_BREADCRUMB && data) {
    const crumb = data as ConsoleBreadcrumb;
    consoleBreadcrumbs.unshift(crumb);
    if (consoleBreadcrumbs.length > MAX_ERRORS) {
      consoleBreadcrumbs.pop();
    }
    // 兼容 consoleErrors 字符串数组
    if (crumb.level === 'error') {
      const summary = crumb.stack ? `${crumb.message}\n  ${crumb.stack.split('\n').slice(1, 4).join('\n  ')}` : crumb.message;
      consoleErrors.unshift(summary);
      if (consoleErrors.length > MAX_ERRORS) {
        consoleErrors.pop();
      }
    }
  } else if (type === MSG_TYPE_CONSOLE_ERROR && typeof data === 'string') {
    consoleErrors.unshift(data);
    if (consoleErrors.length > MAX_ERRORS) {
      consoleErrors.pop();
    }
  }
});

// 3. 监听用户操作轨迹 (DOM 点击、表单修改、按键与 SPA 路由)
function trackAction(action: string) {
  const trimmed = action.trim();
  if (!trimmed) return;
  const timeStr = new Date().toTimeString().split(' ')[0];
  recentActions.unshift(`[${timeStr}] ${trimmed}`);
  if (recentActions.length > MAX_ACTIONS) {
    recentActions.pop();
  }
}

function getElementDescriptor(el: HTMLElement): string {
  const tag = el.tagName ? el.tagName.toLowerCase() : 'element';
  const testId = el.getAttribute('data-testid') || el.getAttribute('data-test');
  if (testId) return `${tag}[data-testid="${testId}"]`;
  if (el.id) return `${tag}#${el.id}`;
  if (el.className && typeof el.className === 'string') {
    const cls = el.className.split(' ').filter(c => c && !c.includes(':')).slice(0, 2).join('.');
    if (cls) return `${tag}.${cls}`;
  }
  return tag;
}

// 监听点击
document.addEventListener('click', (event) => {
  try {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const desc = getElementDescriptor(target);
    let text = (target.innerText || target.getAttribute('title') || target.getAttribute('aria-label') || target.getAttribute('placeholder') || '').trim();
    if (text.length > 40) text = text.slice(0, 40) + '…';
    trackAction(`点击 <${desc}> ${text ? `"${text}"` : ''}`);
  } catch {}
}, true);

// 监听表单输入失焦变更 (不采集具体敏感内容，保护隐私同时留下轨迹)
document.addEventListener('change', (event) => {
  try {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const tag = target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      const type = (target as HTMLInputElement).type || '';
      const name = (target as HTMLInputElement).name || target.id || target.getAttribute('placeholder') || '';
      trackAction(`更改表单 <${tag}${type ? `:${type}` : ''}> ${name ? `[${name}]` : ''}`);
    }
  } catch {}
}, true);

// 监听关键键盘事件 (Enter / Esc / Tab)
document.addEventListener('keydown', (event) => {
  try {
    if (event.key === 'Enter' || event.key === 'Escape' || event.key === 'Tab') {
      const target = event.target as HTMLElement | null;
      const desc = target ? getElementDescriptor(target) : 'body';
      trackAction(`按键 [${event.key}] on <${desc}>`);
    }
  } catch {}
}, true);

// 监听路由变化
window.addEventListener('popstate', () => {
  trackAction(`路由变化 (popstate): ${window.location.pathname}${window.location.hash}`);
});

window.addEventListener('hashchange', () => {
  trackAction(`路由变化 (hashchange): ${window.location.hash}`);
});

// 4. 环境与性能指标采集
function getBrowserInfo(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome')) {
    const m = ua.match(/Chrome\/([\d.]+)/);
    return `Chrome ${m ? m[1] : ''}`;
  }
  if (ua.includes('Firefox')) {
    const m = ua.match(/Firefox\/([\d.]+)/);
    return `Firefox ${m ? m[1] : ''}`;
  }
  if (ua.includes('Safari')) {
    const m = ua.match(/Version\/([\d.]+)/);
    return `Safari ${m ? m[1] : ''}`;
  }
  return navigator.userAgent;
}

function getOSInfo(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Macintosh') || ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Unknown OS';
}

function getNetworkStatus(): string {
  const conn = (navigator as any).connection;
  if (conn) {
    const type = conn.effectiveType || conn.type || '';
    const rtt = conn.rtt ? `${conn.rtt}ms` : '';
    return [type, rtt, navigator.onLine ? '在线' : '离线'].filter(Boolean).join(' / ');
  }
  return navigator.onLine ? '在线' : '离线';
}

function getPerformanceMetrics(): PerformanceMetrics {
  const metrics: PerformanceMetrics = {};
  try {
    // 内存情况 (Chrome 特有)
    const mem = (performance as any).memory;
    if (mem) {
      metrics.jsHeapUsedMb = Math.round(mem.usedJSHeapSize / (1024 * 1024) * 10) / 10;
      metrics.jsHeapTotalMb = Math.round(mem.totalJSHeapSize / (1024 * 1024) * 10) / 10;
    }

    // 页面加载耗时
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
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
  } catch {}
  return metrics;
}

// 5. 响应 background / sidepanel 的快照请求
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request && request.type === MSG_TYPE_SNAPSHOT_REQUEST) {
    const failedRequests = recentRequests.filter(r => r.isFailed);
    const errorCount = consoleBreadcrumbs.filter(c => c.level === 'error').length || consoleErrors.length;

    const snapshot: HostContextSnapshot = {
      pageTitle: document.title || '无标题页面',
      pageURL: window.location.href,
      browserInfo: getBrowserInfo(),
      osInfo: getOSInfo(),
      viewportSize: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}x`,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      colorScheme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light',
      networkStatus: getNetworkStatus(),
      timestamp: Date.now(),
      recentActions: [...recentActions],
      recentRequests: [...recentRequests],
      consoleErrors: [...consoleErrors],
      consoleBreadcrumbs: [...consoleBreadcrumbs],
      performanceMetrics: getPerformanceMetrics(),
      diagnostics: {
        failedRequestCount: failedRequests.length,
        errorCount,
      },
      supplementaryInfo: {},
    };
    sendResponse({ success: true, data: snapshot });
    return true;
  }
});
