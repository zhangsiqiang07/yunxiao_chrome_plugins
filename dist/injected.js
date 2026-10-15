(function() {
  if (window.__YXB_INJECTED__) return;
  window.__YXB_INJECTED__ = true;
  const SENSITIVE_PARAM_KEYWORDS = [
    "token",
    "password",
    "secret",
    "credential",
    "apikey",
    "api_key",
    "access_token",
    "auth"
  ];
  const TRACKING_HEADER_KEYS = [
    "x-request-id",
    "x-trace-id",
    "eagleeye-traceid",
    "x-eagleeye-id",
    "traceparent",
    "x-b3-traceid",
    "x-correlation-id",
    "content-type",
    "server",
    "x-cache",
    "x-env"
  ];
  function sanitizeURL(rawURL) {
    try {
      const url = new URL(rawURL, window.location.href);
      const searchParams = new URLSearchParams(url.search);
      let changed = false;
      for (const key of Array.from(searchParams.keys())) {
        const lower = key.toLowerCase();
        if (SENSITIVE_PARAM_KEYWORDS.some((kw) => lower.includes(kw))) {
          searchParams.set(key, "<redacted>");
          changed = true;
        }
      }
      if (changed) url.search = searchParams.toString();
      return url.toString();
    } catch {
      return rawURL;
    }
  }
  function maskObject(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(maskObject);
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      const lower = k.toLowerCase();
      if (SENSITIVE_PARAM_KEYWORDS.some((kw) => lower.includes(kw))) {
        result[k] = "<redacted>";
      } else if (typeof v === "object" && v !== null) {
        result[k] = maskObject(v);
      } else {
        result[k] = v;
      }
    }
    return result;
  }
  function sanitizeBody(body, maxLength = 12e3) {
    if (!body) return null;
    const trimmed = body.trim();
    if (!trimmed || trimmed === "{}") return "{}";
    try {
      const parsed = JSON.parse(trimmed);
      const jsonStr = JSON.stringify(maskObject(parsed), null, 2);
      return jsonStr.length > maxLength ? jsonStr.slice(0, maxLength) + "\n\n[内容过长，已截断]" : jsonStr;
    } catch {
      return trimmed.length > maxLength ? trimmed.slice(0, maxLength) + "\n\n[内容过长，已截断]" : trimmed;
    }
  }
  function extractSafeHeaders(headersObj) {
    const safe = {};
    if (!headersObj) return safe;
    try {
      if (typeof headersObj.forEach === "function") {
        headersObj.forEach((val, key) => {
          const lKey = key.toLowerCase();
          if (TRACKING_HEADER_KEYS.some((k) => lKey.includes(k))) {
            safe[key] = val;
          }
        });
      } else if (typeof headersObj === "object") {
        for (const [k, v] of Object.entries(headersObj)) {
          const lKey = k.toLowerCase();
          if (TRACKING_HEADER_KEYS.some((tk) => lKey.includes(tk))) {
            safe[k] = String(v);
          }
        }
      }
    } catch {
    }
    return safe;
  }
  function parseXHRResponseHeaders(raw) {
    const res = {};
    if (!raw) return res;
    try {
      const lines = raw.trim().split(/[\r\n]+/);
      for (const line of lines) {
        const parts = line.split(": ");
        const key = parts.shift();
        const value = parts.join(": ");
        if (key && value) {
          const lKey = key.toLowerCase();
          if (TRACKING_HEADER_KEYS.some((k) => lKey.includes(k))) {
            res[key] = value;
          }
        }
      }
    } catch {
    }
    return res;
  }
  function findTraceId(reqHeaders, respHeaders) {
    const all = { ...reqHeaders, ...respHeaders };
    for (const [k, v] of Object.entries(all)) {
      const lower = k.toLowerCase();
      if (lower.includes("eagleeye-traceid") || lower.includes("x-request-id") || lower.includes("x-trace-id") || lower.includes("traceparent")) {
        return v;
      }
    }
    return void 0;
  }
  function isStaticResource(url) {
    const lower = url.toLowerCase();
    return /\.(png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot|css)(\?|$)/.test(lower) || lower.startsWith("chrome-extension://") || lower.includes("openapi-rdc.aliyuncs.com");
  }
  function postBreadcrumb(crumb) {
    try {
      window.postMessage({ type: "YXB_NETWORK_BREADCRUMB", data: crumb }, "*");
    } catch {
    }
  }
  function postConsoleBreadcrumb(level, message, stack) {
    try {
      window.postMessage({
        type: "YXB_CONSOLE_BREADCRUMB",
        data: {
          id: Math.random().toString(36).slice(2),
          level,
          message,
          stack,
          timestamp: Date.now()
        }
      }, "*");
    } catch {
    }
  }
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const start = Date.now();
    let method = "GET";
    let url = "";
    let reqBody = null;
    let reqHeaders = {};
    try {
      if (typeof args[0] === "string") {
        url = args[0];
      } else if (args[0] instanceof Request) {
        url = args[0].url;
        method = args[0].method;
        reqHeaders = extractSafeHeaders(args[0].headers);
      } else if (args[0] && typeof args[0].href === "string") {
        url = args[0].href;
      }
      if (args[1]) {
        if (args[1].method) method = args[1].method.toUpperCase();
        if (typeof args[1].body === "string") reqBody = args[1].body;
        if (args[1].headers) {
          reqHeaders = { ...reqHeaders, ...extractSafeHeaders(args[1].headers) };
        }
      }
    } catch {
    }
    const shouldIgnore = !url || isStaticResource(url);
    try {
      const response = await originalFetch.apply(this, args);
      if (!shouldIgnore) {
        const duration = Date.now() - start;
        const cloned = response.clone();
        const respHeaders = extractSafeHeaders(cloned.headers);
        const traceId = findTraceId(reqHeaders, respHeaders);
        const isFailed = response.status >= 400 || !response.ok;
        const contentType = cloned.headers.get("content-type") || "";
        if (contentType.includes("json") || contentType.includes("text")) {
          cloned.text().then((text) => {
            postBreadcrumb({
              id: Math.random().toString(36).slice(2),
              method,
              path: sanitizeURL(url),
              requestHeaders: reqHeaders,
              requestBody: sanitizeBody(reqBody),
              statusCode: response.status,
              durationMs: duration,
              error: isFailed ? `HTTP ${response.status} ${response.statusText || ""}`.trim() : null,
              responseHeaders: respHeaders,
              responseBody: sanitizeBody(text),
              timestamp: Date.now(),
              isFailed,
              traceId
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
              traceId
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
            traceId
          });
        }
      }
      return response;
    } catch (err) {
      if (!shouldIgnore) {
        postBreadcrumb({
          id: Math.random().toString(36).slice(2),
          method,
          path: sanitizeURL(url),
          requestHeaders: reqHeaders,
          requestBody: sanitizeBody(reqBody),
          statusCode: null,
          durationMs: Date.now() - start,
          error: err?.message || "NetworkError",
          responseHeaders: {},
          responseBody: null,
          timestamp: Date.now(),
          isFailed: true
        });
      }
      throw err;
    }
  };
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__yxb_method = method.toUpperCase();
    this.__yxb_url = typeof url === "string" ? url : url.toString();
    this.__yxb_req_headers = {};
    return originalOpen.apply(this, [method, url, ...rest]);
  };
  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    try {
      const lKey = header.toLowerCase();
      if (TRACKING_HEADER_KEYS.some((k) => lKey.includes(k))) {
        if (!this.__yxb_req_headers) this.__yxb_req_headers = {};
        this.__yxb_req_headers[header] = value;
      }
    } catch {
    }
    return originalSetRequestHeader.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    const xhr = this;
    const url = xhr.__yxb_url || "";
    const method = xhr.__yxb_method || "GET";
    const reqHeaders = xhr.__yxb_req_headers || {};
    const shouldIgnore = !url || isStaticResource(url);
    if (!shouldIgnore) {
      const start = Date.now();
      let reqBody = null;
      if (typeof body === "string") reqBody = body;
      xhr.addEventListener("loadend", () => {
        const duration = Date.now() - start;
        let respBody = null;
        try {
          if (typeof xhr.responseText === "string") {
            respBody = xhr.responseText;
          }
        } catch {
        }
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
          error: isFailed ? `HTTP ${status || "Failed"}` : null,
          responseHeaders: respHeaders,
          responseBody: sanitizeBody(respBody),
          timestamp: Date.now(),
          isFailed,
          traceId
        });
      });
    }
    return originalSend.apply(this, arguments);
  };
  function formatArg(arg) {
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}
${arg.stack || ""}`;
    }
    if (typeof arg === "object" && arg !== null) {
      try {
        return JSON.stringify(maskObject(arg));
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }
  const originalConsoleError = console.error;
  console.error = function(...args) {
    try {
      const msg = args.map(formatArg).join(" ");
      let stack;
      const errObj = args.find((a) => a instanceof Error);
      if (errObj && errObj.stack) {
        stack = errObj.stack;
      }
      postConsoleBreadcrumb("error", msg.slice(0, 2e3), stack);
    } catch {
    }
    return originalConsoleError.apply(console, args);
  };
  const originalConsoleWarn = console.warn;
  console.warn = function(...args) {
    try {
      const msg = args.map(formatArg).join(" ");
      postConsoleBreadcrumb("warn", msg.slice(0, 1e3));
    } catch {
    }
    return originalConsoleWarn.apply(console, args);
  };
  window.addEventListener("error", (event) => {
    const msg = event.message || String(event.error || "Unknown error");
    const stack = event.error && event.error.stack ? event.error.stack : void 0;
    postConsoleBreadcrumb("error", `[Uncaught] ${msg} (${event.filename || ""}:${event.lineno || 0})`, stack);
  });
  window.addEventListener("unhandledrejection", (event) => {
    let msg = "Unhandled Promise Rejection";
    let stack;
    if (event.reason instanceof Error) {
      msg = `${event.reason.name}: ${event.reason.message}`;
      stack = event.reason.stack;
    } else if (typeof event.reason === "string") {
      msg = event.reason;
    } else {
      try {
        msg = JSON.stringify(maskObject(event.reason));
      } catch {
        msg = String(event.reason);
      }
    }
    postConsoleBreadcrumb("error", `[UnhandledRejection] ${msg}`, stack);
  });
})();
