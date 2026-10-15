/**
 * 网络与上下文数据脱敏工具（对标 YXBBugContext 隐私红线）
 */

const SENSITIVE_HEADER_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-yunxiao-token',
  'proxy-authorization',
]);

const SENSITIVE_PARAM_KEYWORDS = [
  'token',
  'password',
  'secret',
  'credential',
  'apikey',
  'api_key',
  'access_token',
  'auth',
];

export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_KEYS.has(key.toLowerCase())) {
      result[key] = '<redacted>';
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function sanitizeURL(rawURL: string): string {
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

    if (changed) {
      url.search = searchParams.toString();
    }
    return url.toString();
  } catch {
    return rawURL;
  }
}

export function sanitizeBody(body: string | null, maxLength = 12000): string | null {
  if (!body) return null;
  const trimmed = body.trim();
  if (!trimmed || trimmed === '{}') return '{}';

  try {
    const parsed = JSON.parse(trimmed);
    const sanitizedObj = maskObject(parsed);
    const jsonStr = JSON.stringify(sanitizedObj, null, 2);
    if (jsonStr.length > maxLength) {
      return jsonStr.slice(0, maxLength) + '\n\n[内容过长，已截断]';
    }
    return jsonStr;
  } catch {
    // 非 JSON 文本直接截断
    if (trimmed.length > maxLength) {
      return trimmed.slice(0, maxLength) + '\n\n[内容过长，已截断]';
    }
    return trimmed;
  }
}

function maskObject(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(maskObject);
  }
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lowerKey = k.toLowerCase();
    if (SENSITIVE_PARAM_KEYWORDS.some(kw => lowerKey.includes(kw))) {
      result[k] = '<redacted>';
    } else if (typeof v === 'object' && v !== null) {
      result[k] = maskObject(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}
