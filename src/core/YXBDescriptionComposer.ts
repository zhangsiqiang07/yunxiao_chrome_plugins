import type { NetworkBreadcrumb, BugContext } from '../collector/types';

const MAX_NETWORK_SUMMARIES = 8;
const MAX_SUMMARY_TEXT_LENGTH = 240;
const MAX_BODY_LENGTH = 12_000;

/**
 * 描述组装器（对标 YXBDescriptionComposer.swift）
 */
export function compose(body: string, context: BugContext): string {
  const parts: string[] = [];
  const trimmed = body.trim();
  if (trimmed) parts.push(balanceFences(trimmed));

  // 环境信息
  const envLines = descriptionLines(context);
  parts.push('## 环境信息\n' + balanceFences(envLines.join('\n')));

  // 最近网络请求
  if (context.recentRequests.length > 0) {
    const requests = context.recentRequests.slice(0, MAX_NETWORK_SUMMARIES);
    const sections = requests.map(networkDetail);
    const omitted = context.recentRequests.length - requests.length;
    if (omitted > 0) sections.push(`- 其余 ${omitted} 条网络请求未附带`);
    parts.push('## 最近网络请求\n' + sections.join('\n\n---\n\n'));
  }

  return parts.join('\n\n');
}

export function networkSummary(b: NetworkBreadcrumb, prefix = '- '): string {
  const path = b.path.split('?')[0].split('#')[0];
  let s = `${prefix}${compact(path)} · ${b.statusCode ?? '无状态码'} · ${b.durationMs}ms`;
  if (b.error) s += ` · 错误：${compact(b.error)}`;
  return s;
}

function descriptionLines(ctx: BugContext): string[] {
  const lines: string[] = [];
  lines.push(`- 页面：${ctx.pageTitle || '未知'}`);
  lines.push(`- URL：${ctx.pageURL || '未知'}`);
  lines.push(`- 浏览器：${ctx.browserInfo || '未知'}`);
  lines.push(`- 系统：${ctx.osInfo || '未知'}`);
  lines.push(`- 视口：${ctx.viewportSize || '未知'}`);
  lines.push(`- 网络：${ctx.networkStatus || '未知'}`);
  lines.push(`- 截图：${ctx.screenshotCount} 张`);
  const d = new Date(ctx.timestamp);
  lines.push(`- 时间：${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);
  if (ctx.recentActions.length > 0) {
    lines.push(`- 最近操作：${ctx.recentActions.join(' →\n')}`);
  }
  if (ctx.consoleErrors.length > 0) {
    lines.push(`- 控制台报错：${ctx.consoleErrors.slice(0, 5).join('; ')}`);
  }
  for (const [k, v] of Object.entries(ctx.supplementaryInfo ?? {})) {
    lines.push(`- ${k}：${v}`);
  }
  return lines;
}

function networkDetail(b: NetworkBreadcrumb): string {
  const parts = [networkSummary(b)];
  if (!b.requestBody || b.requestBody.trim() === '' || b.requestBody.trim() === '{}') {
    parts.push('请求体：空');
  } else {
    parts.push('请求体\n' + fencedCodeBlock(b.requestBody));
  }
  if (b.responseBody && b.responseBody.trim()) {
    parts.push('响应体\n' + fencedCodeBlock(b.responseBody));
  }
  return parts.join('\n');
}

function compact(value: string): string {
  const s = value.replace(/\n/g, ' ').trim();
  return s.length > MAX_SUMMARY_TEXT_LENGTH ? s.slice(0, MAX_SUMMARY_TEXT_LENGTH) + '…' : s;
}

function fencedCodeBlock(body: string): string {
  const content = body.length > MAX_BODY_LENGTH
    ? body.slice(0, MAX_BODY_LENGTH) + '\n\n[内容过长，已截断]'
    : body;
  const maxRun = longestBacktickRun(content);
  const fence = '`'.repeat(Math.max(3, maxRun + 1));
  return `${fence}text\n${content}\n${fence}`;
}

function longestBacktickRun(s: string): number {
  let max = 0, cur = 0;
  for (const c of s) { if (c === '`') { cur++; max = Math.max(max, cur); } else cur = 0; }
  return max;
}

function balanceFences(text: string): string {
  let openFence: { marker: string; len: number } | null = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^( {0,3})(`{3,}|~{3,})/);
    if (!m) continue;
    const marker = m[2][0];
    const len = m[2].length;
    if (openFence && marker === openFence.marker && len >= openFence.len && line.trim() === m[2]) {
      openFence = null;
    } else if (!openFence) {
      openFence = { marker, len };
    }
  }
  if (!openFence) return text;
  const closing = openFence.marker.repeat(openFence.len);
  return text + (text.endsWith('\n') ? '' : '\n') + closing;
}
