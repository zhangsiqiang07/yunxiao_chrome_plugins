/**
 * injected.ts
 * 运行在网页的 MAIN world 中，无感拦截 fetch / XMLHttpRequest / 控制台报错。
 * 数据经过脱敏后通过 window.postMessage 传递给 Content Script (ISOLATED world)。
 */

(function () {
  // 防止重复注入
  if ((window as any).__YXB_INJECTED__) return;
  (window as any).__YXB_INJECTED__ = true;

  const SENSITIVE_PARAM_KEYWORDS = [
    'token', 'password', 'secret', 'credential', 'apikey', 'api_key', 'access_token', 'auth',
  ];

  function sanitizeURL(rawURL: string): string {
    try {
      const url = new URL(rawURL, window.location.href);
      const searchParams = new URLSearchParams(url.search);
      let changed = false;
      for (const key of Array.from(searchParams.keys())) {
        const lower = key.toLowerCase();
        if (SENSITIVE_PARAM_KEYWORDS.some(kw => lower.includes(kw))) {
          searchParams.set(key, '<redacted>');
          changed = true;
        }
      }
      if (changed) url.search = searchParams.toString();
      return url.toString();
    } catch {
      return rawURL;
    }
  }

  function maskObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(maskObject);
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      const lower = k.toLowerCase();
      if (SENSITIVE_PARAM_KEYWORDS.some(kw => lower.includes(kw))) {
        result[k] = '<redacted>';
      } else if (typeof v === 'object' && v !== null) {
        result[k] = maskObject(v);
      } else {
        result[k] = v;
      }
    }
    return result;
  }

  function sanitizeBody(body: string | null, maxLength = 12000): string | null {
    if (!body) return null;
    const trimmed = body.trim();
    if (!trimmed || trimmed === '{}') return '{}';
    try {
      const parsed = JSON.parse(trimmed);
      const jsonStr = JSON.stringify(maskObject(parsed), null, 2);
      return jsonStr.length > maxLength ? jsonStr.slice(0, maxLength) + '\n\n[内容过长，已截断]' : jsonStr;
    } catch {
      return trimmed.length > maxLength ? trimmed.slice(0, maxLength) + '\n\n[内容过长，已截断]' : trimmed;
    }
  }

  function isStaticResource(url: string): boolean {
    const lower = url.toLowerCase();
    return /\.(png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot|css)(\?|$)/.test(lower) ||
           lower.startsWith('chrome-extension://') ||
           lower.includes('openapi-rdc.aliyuncs.com');
  }

  function postBreadcrumb(crumb: any) {
    try {
      window.postMessage({ type: 'YXB_NETWORK_BREADCRUMB', data: crumb }, '*');
    } catch {
      // 避免序列化失败影响页面
    }
  }

  function postConsoleError(errText: string) {
    try {
      window.postMessage({ type: 'YXB_CONSOLE_ERROR', data: errText }, '*');
    } catch {}
  }

  // 1. 拦截 fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const start = Date.now();
    let method = 'GET';
    let url = '';
    let reqBody: string | null = null;

    try {
      if (typeof args[0] === 'string') {
        url = args[0];
      } else if (args[0] instanceof Request) {
        url = args[0].url;
        method = args[0].method;
      } else if (args[0] && typeof (args[0] as any).href === 'string') {
        url = (args[0] as any).href;
      }
      if (args[1]) {
        if (args[1].method) method = args[1].method.toUpperCase();
        if (typeof args[1].body === 'string') reqBody = args[1].body;
      }
    } catch {}

    const shouldIgnore = !url || isStaticResource(url);

    try {
      const response = await originalFetch.apply(this, args);
      if (!shouldIgnore) {
        const duration = Date.now() - start;
        const cloned = response.clone();
        let respBody: string | null = null;

        const contentType = cloned.headers.get('content-type') || '';
        if (contentType.includes('json') || contentType.includes('text')) {
          cloned.text().then(text => {
            respBody = text;
            postBreadcrumb({
              id: Math.random().toString(36).slice(2),
              method,
              path: sanitizeURL(url),
              requestHeaders: {},
              requestBody: sanitizeBody(reqBody),
              statusCode: response.status,
              durationMs: duration,
              error: response.ok ? null : `HTTP ${response.status}`,
              responseHeaders: {},
              responseBody: sanitizeBody(respBody),
              timestamp: Date.now(),
            });
          }).catch(() => {
            postBreadcrumb({
              id: Math.random().toString(36).slice(2),
              method,
              path: sanitizeURL(url),
              requestHeaders: {},
              requestBody: sanitizeBody(reqBody),
              statusCode: response.status,
              durationMs: duration,
              error: null,
              responseHeaders: {},
              responseBody: null,
              timestamp: Date.now(),
            });
          });
        } else {
          postBreadcrumb({
            id: Math.random().toString(36).slice(2),
            method,
            path: sanitizeURL(url),
            requestHeaders: {},
            requestBody: sanitizeBody(reqBody),
            statusCode: response.status,
            durationMs: duration,
            error: null,
            responseHeaders: {},
            responseBody: null,
            timestamp: Date.now(),
          });
        }
      }
      return response;
    } catch (err: any) {
      if (!shouldIgnore) {
        postBreadcrumb({
          id: Math.random().toString(36).slice(2),
          method,
          path: sanitizeURL(url),
          requestHeaders: {},
          requestBody: sanitizeBody(reqBody),
          statusCode: null,
          durationMs: Date.now() - start,
          error: err?.message || 'NetworkError',
          responseHeaders: {},
          responseBody: null,
          timestamp: Date.now(),
        });
      }
      throw err;
    }
  };

  // 2. 拦截 XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
    (this as any).__yxb_method = method.toUpperCase();
    (this as any).__yxb_url = typeof url === 'string' ? url : url.toString();
    return (originalOpen as any).apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const xhr = this;
    const url = (xhr as any).__yxb_url || '';
    const method = (xhr as any).__yxb_method || 'GET';
    const shouldIgnore = !url || isStaticResource(url);

    if (!shouldIgnore) {
      const start = Date.now();
      let reqBody: string | null = null;
      if (typeof body === 'string') reqBody = body;

      xhr.addEventListener('loadend', () => {
        const duration = Date.now() - start;
        let respBody: string | null = null;
        try {
          if (typeof xhr.responseText === 'string') {
            respBody = xhr.responseText;
          }
        } catch {}

        postBreadcrumb({
          id: Math.random().toString(36).slice(2),
          method,
          path: sanitizeURL(url),
          requestHeaders: {},
          requestBody: sanitizeBody(reqBody),
          statusCode: xhr.status || null,
          durationMs: duration,
          error: (xhr.status >= 200 && xhr.status < 400) ? null : `HTTP ${xhr.status || 'Failed'}`,
          responseHeaders: {},
          responseBody: sanitizeBody(respBody),
          timestamp: Date.now(),
        });
      });
    }

    return originalSend.apply(this, arguments as any);
  };

  // 3. 错误监听
  window.addEventListener('error', (event) => {
    const msg = event.message || String(event.error || 'Unknown error');
    postConsoleError(`[UncaughtError] ${msg} at ${event.filename || ''}:${event.lineno || 0}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    postConsoleError(`[UnhandledRejection] ${reason}`);
  });
})();
