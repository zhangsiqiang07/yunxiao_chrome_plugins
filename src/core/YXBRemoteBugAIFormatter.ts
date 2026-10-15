/**
 * Bug AI 远程整理服务（对标 YXBRemoteBugAIFormatter.swift）
 */

export interface YXBBugAIGenerateRequest {
  description: string;
  issue_type?: string | null;
  severity?: string | null;
  frequency?: string | null;
  page?: { name?: string | null; route?: string | null } | null;
  recent_actions: string[];
  environment?: {
    app_version?: string | null;
    build?: string | null;
    device?: string | null;
    os_version?: string | null;
    network?: string | null;
  } | null;
  extra?: Record<string, string>;
  images?: { data: string; mime_type: string }[];  // base64
}

export interface YXBBugAIGeneratedReport {
  title: string;
  actual_result: string;
  expected_result?: string | null;
  expected_result_inferred: boolean;
  reproduction_steps: string[];
  module?: string | null;
  issue_type?: string | null;
  severity: string;
  frequency: string;
  missing_information: string[];
}

export class YXBRemoteBugAIFormatter {
  private endpoint: string;

  constructor(serviceDomain: string) {
    const base = serviceDomain.replace(/\/+$/, '');
    this.endpoint = `${base}/api/v1/bug-report/generate`;
  }

  async generate(payload: YXBBugAIGenerateRequest): Promise<YXBBugAIGeneratedReport> {
    const resp = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      let msg = '';
      try { const j = await resp.json(); msg = j.detail ?? ''; } catch { msg = resp.statusText; }
      throw new Error(`Bug AI 服务请求失败（HTTP ${resp.status}）${msg ? '：' + msg : ''}`);
    }
    const json = await resp.json();
    return json.data as YXBBugAIGeneratedReport;
  }
}
