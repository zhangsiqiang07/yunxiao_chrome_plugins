import type { YXBConfiguration } from '../models/YXBConfiguration';
import { YXBError } from '../models/YXBError';
import { endpointPath, type EndpointType } from './YXBEndpoint';

/**
 * HTTP 传输层（对标 YXBHTTPClient.swift + YXBTransport.swift）
 * 基于原生 fetch，Token 日志一律 <redacted>
 */
export class YXBHTTPClient {
  /** 发送 JSON 请求并解析响应 */
  async send<T>(
    config: YXBConfiguration,
    endpoint: EndpointType,
    method: string,
    token: string,
    query?: Record<string, string>,
    body?: unknown,
  ): Promise<T> {
    const url = this.buildURL(config.domain, endpointPath(endpoint, config), query);
    const headers: Record<string, string> = {
      'x-yunxiao-token': token,
      'Accept': 'application/json',
    };
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    console.log(`→ ${method} ${url} headers={...x-yunxiao-token:<redacted>...} body=${init.body ? (init.body as string).length : 0} bytes`);
    const t0 = Date.now();
    const resp = await fetch(url, init);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    if (!resp.ok) {
      let msg = '';
      try { const j = await resp.json(); msg = j.message || j.errorMessage || j.Message || JSON.stringify(j); } catch { msg = resp.statusText; }
      console.log(`← ${resp.status} ${url}（${elapsed}s）：${msg}`);
      throw YXBError.httpError(resp.status, msg);
    }
    const text = await resp.text();
    let data: any = {};
    if (text && text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    console.log(`← ${resp.status} ${url}（${elapsed}s）`);
    return data as T;
  }

  /** 发送 FormData（附件上传） */
  async sendFormData(
    config: YXBConfiguration,
    endpoint: EndpointType,
    token: string,
    formData: FormData,
  ): Promise<any> {
    const url = this.buildURL(config.domain, endpointPath(endpoint, config));
    const headers: Record<string, string> = { 'x-yunxiao-token': token };
    console.log(`→ POST(multipart) ${url}`);
    const t0 = Date.now();
    const resp = await fetch(url, { method: 'POST', headers, body: formData });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    if (!resp.ok) {
      let msg = '';
      try { const j = await resp.json(); msg = j.message || j.errorMessage || ''; } catch { msg = resp.statusText; }
      console.log(`← ${resp.status} ${url}（${elapsed}s）：${msg}`);
      throw YXBError.httpError(resp.status, msg);
    }
    const data = await resp.json();
    console.log(`← ${resp.status} ${url}（${elapsed}s）`);
    return data;
  }

  /** 发送无响应体请求（如 PUT 更新描述） */
  async sendNoContent(
    config: YXBConfiguration,
    endpoint: EndpointType,
    method: string,
    token: string,
    body?: unknown,
  ): Promise<void> {
    const url = this.buildURL(config.domain, endpointPath(endpoint, config));
    const headers: Record<string, string> = {
      'x-yunxiao-token': token,
      'Content-Type': 'application/json',
    };
    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    const resp = await fetch(url, init);
    if (!resp.ok) {
      let msg = '';
      try { const j = await resp.json(); msg = j.message || ''; } catch { msg = resp.statusText; }
      throw YXBError.httpError(resp.status, msg);
    }
  }

  /** 下载二进制数据（图片） */
  async download(url: string, token?: string): Promise<ArrayBuffer> {
    const headers: Record<string, string> = { 'Accept': 'image/*,application/octet-stream,*/*' };
    if (token) headers['x-yunxiao-token'] = token;
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw YXBError.httpError(resp.status, resp.statusText);
    return resp.arrayBuffer();
  }

  private buildURL(domain: string, path: string, query?: Record<string, string>): string {
    const base = domain.replace(/\/+$/, '');
    const u = new URL(path, base);
    if (query) Object.entries(query).forEach(([k, v]) => u.searchParams.set(k, v));
    return u.toString();
  }
}
