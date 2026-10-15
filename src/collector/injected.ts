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

  // 重点白名单保留的追踪与排查 Headers
  const TRACKING_HEADER_KEYS = [
    'x-request-id', 'x-trace-id', 'eagleeye-traceid', 'x-eagleeye-id', 'traceparent',
    'x-b3-traceid', 'x-correlation-id', 'content-type', 'server', 'x-cache', 'x-env'
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

  function extractSafeHeaders(headersObj: any): Record<string, string> {
    const safe: Record<string, string> = {};
    if (!headersObj) return safe;

    try {
      if (typeof headersObj.forEach === 'function') {
        headersObj.forEach((val: string, key: string) => {
          const lKey = key.toLowerCase();
          if (TRACKING_HEADER_KEYS.some(k => lKey.includes(k))) {
            safe[key] = val;
          }
        });
      } else if (typeof headersObj === 'object') {
        for (const [k, v] of Object.entries(headersObj)) {
          const lKey = k.toLowerCase();
          if (TRACKING_HEADER_KEYS.some(tk => lKey.includes(tk))) {
            safe[k] = String(v);
          }
        }
      }
    } catch {}

    return safe;
  }

  function parseXHRResponseHeaders(raw: string | null): Record<string, string> {
    const res: Record<string, string> = {};
    if (!raw) return res;
    try {
      const lines = raw.trim().split(/[\r\n]+/);
      for (const line of lines) {
        const parts = line.split(': ');
        const key = parts.shift();
        const value = parts.join(': ');
        if (key && value) {
          const lKey = key.toLowerCase();
          if (TRACKING_HEADER_KEYS.some(k => lKey.includes(k))) {
            res[key] = value;
          }
        }
      }
    } catch {}
    return res;
  }

  function findTraceId(reqHeaders: Record<string, string>, respHeaders: Record<string, string>): string | undefined {
    const all = { ...reqHeaders, ...respHeaders };
    for (const [k, v] of Object.entries(all)) {
      const lower = k.toLowerCase();
      if (
        lower.includes('eagleeye-traceid') ||
        lower.includes('x-request-id') ||
        lower.includes('x-trace-id') ||
        lower.includes('traceparent')
      ) {
        return v;
      }
    }
    return undefined;
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
    } catch {}
  }

  function postConsoleBreadcrumb(level: 'error' | 'warn', message: string, stack?: string) {
    try {
      window.postMessage({
        type: 'YXB_CONSOLE_BREADCRUMB',
        data: {
          id: Math.random().toString(36).slice(2),
          level,
          message,
          stack,
          timestamp: Date.now(),
        }
      }, '*');
    } catch {}
  }

  // 1. 拦截 fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const start = Date.now();
    let method = 'GET';
    let url = '';
    let reqBody: string | null = null;
    let reqHeaders: Record<string, string> = {};

    try {
      if (typeof args[0] === 'string') {
        url = args[0];
      } else if (args[0] instanceof Request) {
        url = args[0].url;
        method = args[0].method;
        reqHeaders = extractSafeHeaders(args[0].headers);
      } else if (args[0] && typeof (args[0] as any).href === 'string') {
        url = (args[0] as any).href;
      }
      if (args[1]) {
        if (args[1].method) method = args[1].method.toUpperCase();
        if (typeof args[1].body === 'string') reqBody = args[1].body;
        if (args[1].headers) {
          reqHeaders = { ...reqHeaders, ...extractSafeHeaders(args[1].headers) };
        }
      }
    } catch {}

    const shouldIgnore = !url || isStaticResource(url);

    try {
      const response = await originalFetch.apply(this, args);
      if (!shouldIgnore) {
        const duration = Date.now() - start;
        const cloned = response.clone();
        const respHeaders = extractSafeHeaders(cloned.headers);
        const traceId = findTraceId(reqHeaders, respHeaders);
        const isFailed = response.status >= 400 || !response.ok;

        const contentType = cloned.headers.get('content-type') || '';
        if (contentType.includes('json') || contentType.includes('text')) {
          cloned.text().then(text => {
            postBreadcrumb({
              id: Math.random().toString(36).slice(2),
              method,
              path: sanitizeURL(url),
              requestHeaders: reqHeaders,
              requestBody: sanitizeBody(reqBody),
              statusCode: response.status,
              durationMs: duration,
              error: isFailed ? `HTTP ${response.status} ${response.statusText || ''}`.trim() : null,
              responseHeaders: respHeaders,
              responseBody: sanitizeBody(text),
              timestamp: Date.now(),
              isFailed,
              traceId,
            });
          }).catch(() => {
            postBreadcrumb({
              id: Math.random().toString(36).slice(2),
              method,
              path: sanitizeURL(url),
              requestHeaders: reqHeaders,
              requestBody: sanitizeBody(reqBody),
              statusCode: response.status,
              durationMs: duration,
              error: isFailed ? `HTTP ${response.status}` : null,
              responseHeaders: respHeaders,
              responseBody: null,
              timestamp: Date.now(),
              isFailed,
              traceId,
            });
          });
        } else {
          postBreadcrumb({
            id: Math.random().toString(36).slice(2),
            method,
            path: sanitizeURL(url),
            requestHeaders: reqHeaders,
            requestBody: sanitizeBody(reqBody),
            statusCode: response.status,
            durationMs: duration,
            error: isFailed ? `HTTP ${response.status}` : null,
            responseHeaders: respHeaders,
            responseBody: null,
            timestamp: Date.now(),
            isFailed,
            traceId,
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
          requestHeaders: reqHeaders,
          requestBody: sanitizeBody(reqBody),
          statusCode: null,
          durationMs: Date.now() - start,
          error: err?.message || 'NetworkError',
          responseHeaders: {},
          responseBody: null,
          timestamp: Date.now(),
          isFailed: true,
        });
      }
      throw err;
    }
  };

  // 2. 拦截 XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
    (this as any).__yxb_method = method.toUpperCase();
    (this as any).__yxb_url = typeof url === 'string' ? url : url.toString();
    (this as any).__yxb_req_headers = {};
    return (originalOpen as any).apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (header: string, value: string) {
    try {
      const lKey = header.toLowerCase();
      if (TRACKING_HEADER_KEYS.some(k => lKey.includes(k))) {
        if (!(this as any).__yxb_req_headers) (this as any).__yxb_req_headers = {};
        (this as any).__yxb_req_headers[header] = value;
      }
    } catch {}
    return originalSetRequestHeader.apply(this, arguments as any);
  };

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const xhr = this;
    const url = (xhr as any).__yxb_url || '';
    const method = (xhr as any).__yxb_method || 'GET';
    const reqHeaders = (xhr as any).__yxb_req_headers || {};
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

        const respHeaders = parseXHRResponseHeaders(xhr.getAllResponseHeaders());
        const traceId = findTraceId(reqHeaders, respHeaders);
        const status = xhr.status || null;
        const isFailed = !status || status >= 400;

        postBreadcrumb({
          id: Math.random().toString(36).slice(2),
          method,
          path: sanitizeURL(url),
          requestHeaders: reqHeaders,
          requestBody: sanitizeBody(reqBody),
          statusCode: status,
          durationMs: duration,
          error: isFailed ? `HTTP ${status || 'Failed'}` : null,
          responseHeaders: respHeaders,
          responseBody: sanitizeBody(respBody),
          timestamp: Date.now(),
          isFailed,
          traceId,
        });
      });
    }

    return originalSend.apply(this, arguments as any);
  };

  // 3. 拦截 console.error 与 console.warn
  function formatArg(arg: any): string {
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
    }
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(maskObject(arg));
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }

  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    try {
      const msg = args.map(formatArg).join(' ');
      let stack: string | undefined;
      const errObj = args.find(a => a instanceof Error);
      if (errObj && errObj.stack) {
        stack = errObj.stack;
      }
      postConsoleBreadcrumb('error', msg.slice(0, 2000), stack);
    } catch {}
    return originalConsoleError.apply(console, args);
  };

  const originalConsoleWarn = console.warn;
  console.warn = function (...args: any[]) {
    try {
      const msg = args.map(formatArg).join(' ');
      postConsoleBreadcrumb('warn', msg.slice(0, 1000));
    } catch {}
    return originalConsoleWarn.apply(console, args);
  };

  // 4. 全局未捕获错误监听
  window.addEventListener('error', (event) => {
    const msg = event.message || String(event.error || 'Unknown error');
    const stack = event.error && event.error.stack ? event.error.stack : undefined;
    postConsoleBreadcrumb('error', `[Uncaught] ${msg} (${event.filename || ''}:${event.lineno || 0})`, stack);
  });

  window.addEventListener('unhandledrejection', (event) => {
    let msg = 'Unhandled Promise Rejection';
    let stack: string | undefined;
    if (event.reason instanceof Error) {
      msg = `${event.reason.name}: ${event.reason.message}`;
      stack = event.reason.stack;
    } else if (typeof event.reason === 'string') {
      msg = event.reason;
    } else {
      try {
        msg = JSON.stringify(maskObject(event.reason));
      } catch {
        msg = String(event.reason);
      }
    }
    postConsoleBreadcrumb('error', `[UnhandledRejection] ${msg}`, stack);
  });
})();
