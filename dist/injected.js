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
  function postConsoleError(errText) {
    try {
      window.postMessage({ type: "YXB_CONSOLE_ERROR", data: errText }, "*");
    } catch {
    }
  }
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const start = Date.now();
    let method = "GET";
    let url = "";
    let reqBody = null;
    try {
      if (typeof args[0] === "string") {
        url = args[0];
      } else if (args[0] instanceof Request) {
        url = args[0].url;
        method = args[0].method;
      } else if (args[0] && typeof args[0].href === "string") {
        url = args[0].href;
      }
      if (args[1]) {
        if (args[1].method) method = args[1].method.toUpperCase();
        if (typeof args[1].body === "string") reqBody = args[1].body;
      }
    } catch {
    }
    const shouldIgnore = !url || isStaticResource(url);
    try {
      const response = await originalFetch.apply(this, args);
      if (!shouldIgnore) {
        const duration = Date.now() - start;
        const cloned = response.clone();
        let respBody = null;
        const contentType = cloned.headers.get("content-type") || "";
        if (contentType.includes("json") || contentType.includes("text")) {
          cloned.text().then((text) => {
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
              timestamp: Date.now()
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
              timestamp: Date.now()
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
            timestamp: Date.now()
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
          requestHeaders: {},
          requestBody: sanitizeBody(reqBody),
          statusCode: null,
          durationMs: Date.now() - start,
          error: err?.message || "NetworkError",
          responseHeaders: {},
          responseBody: null,
          timestamp: Date.now()
        });
      }
      throw err;
    }
  };
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__yxb_method = method.toUpperCase();
    this.__yxb_url = typeof url === "string" ? url : url.toString();
    return originalOpen.apply(this, [method, url, ...rest]);
  };
  XMLHttpRequest.prototype.send = function(body) {
    const xhr = this;
    const url = xhr.__yxb_url || "";
    const method = xhr.__yxb_method || "GET";
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
        postBreadcrumb({
          id: Math.random().toString(36).slice(2),
          method,
          path: sanitizeURL(url),
          requestHeaders: {},
          requestBody: sanitizeBody(reqBody),
          statusCode: xhr.status || null,
          durationMs: duration,
          error: xhr.status >= 200 && xhr.status < 400 ? null : `HTTP ${xhr.status || "Failed"}`,
          responseHeaders: {},
          responseBody: sanitizeBody(respBody),
          timestamp: Date.now()
        });
      });
    }
    return originalSend.apply(this, arguments);
  };
  window.addEventListener("error", (event) => {
    const msg = event.message || String(event.error || "Unknown error");
    postConsoleError(`[UncaughtError] ${msg} at ${event.filename || ""}:${event.lineno || 0}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    postConsoleError(`[UnhandledRejection] ${reason}`);
  });
})();
