import type { NetworkBreadcrumb, BugContext, ConsoleBreadcrumb } from '../collector/types';

const MAX_NETWORK_SUMMARIES = 8;
const MAX_SUMMARY_TEXT_LENGTH = 240;
const MAX_BODY_LENGTH = 12_000;

/**
 * 描述组装器：结构化排版 Bug 上报正文，异常优先高亮，助力秒级排查定位
 */
export function compose(body: string, context: BugContext): string {
  const parts: string[] = [];
  const trimmed = body.trim();
  if (trimmed) parts.push(balanceFences(trimmed));

  // 1. 🚨 异常诊断发现（如果有网络异常或控制台报错，置顶高亮展示）
  const diagnosticSection = composeDiagnostics(context);
  if (diagnosticSection) {
    parts.push(diagnosticSection);
  }

  // 2. 交互操作轨迹（复现步骤线索）
  if (context.recentActions && context.recentActions.length > 0) {
    const actions = context.recentActions.slice(0, 15);
    parts.push('## 用户操作轨迹 (复现参考)\n' + actions.map((a, i) => `${i + 1}. ${a}`).join('\n'));
  }

  // 3. 运行环境与性能指标
  const envLines = descriptionLines(context);
  parts.push('## 运行环境与设备\n' + balanceFences(envLines.join('\n')));

  // 4. 最近网络请求详情（包含正常请求与调用链路）
  if (context.recentRequests.length > 0) {
    const requests = context.recentRequests.slice(0, MAX_NETWORK_SUMMARIES);
    const sections = requests.map(networkDetail);
    const omitted = context.recentRequests.length - requests.length;
    if (omitted > 0) sections.push(`- 其余 ${omitted} 条网络请求未附带`);
    parts.push('## 网络请求明细 (前 8 条)\n' + sections.join('\n\n---\n\n'));
  }

  return parts.join('\n\n');
}

/**
 * 提取核心报错与异常，方便开发与后端人员一眼定位
 */
function composeDiagnostics(ctx: BugContext): string | null {
  const failedRequests = ctx.recentRequests.filter(r => r.isFailed || (r.statusCode && r.statusCode >= 400));
  const errors = ctx.consoleBreadcrumbs || [];
  const stringErrors = ctx.consoleErrors || [];

  if (failedRequests.length === 0 && errors.length === 0 && stringErrors.length === 0) {
    return null;
  }

  const lines: string[] = ['## 🚨 异常诊断发现'];

  // 异常接口
  if (failedRequests.length > 0) {
    lines.push(`### ⚠️ 失败网络请求 (${failedRequests.length} 个)`);
    for (const req of failedRequests.slice(0, 5)) {
      lines.push(`- **[HTTP ${req.statusCode || 'ERR'}] ${req.method} ${req.path}** (耗时: ${req.durationMs}ms)`);
      if (req.traceId) {
        lines.push(`  - **Trace-ID**: \`${req.traceId}\``);
      }
      if (req.error) {
        lines.push(`  - **错误提示**: ${req.error}`);
      }
      if (req.responseBody) {
        lines.push('  - **响应数据**:\n' + fencedCodeBlock(req.responseBody.slice(0, 1500)));
      }
    }
  }

  // 控制台异常堆栈
  if (errors.length > 0) {
    const errorItems = errors.filter(e => e.level === 'error').slice(0, 5);
    if (errorItems.length > 0) {
      lines.push(`### 🔴 控制台报错与调用堆栈 (${errorItems.length} 个)`);
      for (const err of errorItems) {
        lines.push(`- **报错信息**: \`${err.message}\``);
        if (err.stack) {
          lines.push(fencedCodeBlock(err.stack.slice(0, 2000)));
        }
      }
    }
  } else if (stringErrors.length > 0) {
    lines.push(`### 🔴 控制台报错 (${stringErrors.length} 个)`);
    for (const err of stringErrors.slice(0, 5)) {
      lines.push(`- \`${err}\``);
    }
  }

  return lines.join('\n\n');
}

export function networkSummary(b: NetworkBreadcrumb, prefix = '- '): string {
  const path = b.path.split('?')[0].split('#')[0];
  let s = `${prefix}[${b.method}] ${compact(path)} · ${b.statusCode ?? '无状态码'} · ${b.durationMs}ms`;
  if (b.traceId) s += ` · [Trace: ${b.traceId}]`;
  if (b.error) s += ` · 错误：${compact(b.error)}`;
  return s;
}

function descriptionLines(ctx: BugContext): string[] {
  const lines: string[] = [];
  lines.push(`- **页面**：${ctx.pageTitle || '未知'}`);
  lines.push(`- **URL**：${ctx.pageURL || '未知'}`);
  lines.push(`- **浏览器**：${ctx.browserInfo || '未知'}`);
  lines.push(`- **系统**：${ctx.osInfo || '未知'}`);
  lines.push(`- **视口与分辨率**：视口 ${ctx.viewportSize || '未知'}${ctx.screenResolution ? ` / 屏幕 ${ctx.screenResolution}` : ''}`);
  if (ctx.colorScheme) lines.push(`- **色彩偏好**：${ctx.colorScheme} 模式`);
  lines.push(`- **网络状态**：${ctx.networkStatus || '未知'}`);
  lines.push(`- **截图数量**：${ctx.screenshotCount} 张`);

  // 性能指标 (白屏/加载/内存)
  if (ctx.performanceMetrics) {
    const p = ctx.performanceMetrics;
    const perfParts: string[] = [];
    if (p.ttfbMs != null) perfParts.push(`首包响应(TTFB) ${p.ttfbMs}ms`);
    if (p.domContentLoadedMs != null) perfParts.push(`DOM就绪 ${p.domContentLoadedMs}ms`);
    if (p.pageLoadMs != null) perfParts.push(`完全加载 ${p.pageLoadMs}ms`);
    if (p.jsHeapUsedMb != null && p.jsHeapTotalMb != null) {
      perfParts.push(`JS内存 ${p.jsHeapUsedMb}MB / ${p.jsHeapTotalMb}MB`);
    }
    if (perfParts.length > 0) {
      lines.push(`- **页面性能指标**：${perfParts.join(' | ')}`);
    }
  }

  const d = new Date(ctx.timestamp);
  lines.push(`- **上报时间**：${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`);

  for (const [k, v] of Object.entries(ctx.supplementaryInfo ?? {})) {
    lines.push(`- **${k}**：${v}`);
  }
  return lines;
}

function networkDetail(b: NetworkBreadcrumb): string {
  const parts = [networkSummary(b)];

  // 如果有 TraceId，单独高亮
  if (b.traceId) {
    parts.push(`- **Trace-ID**: \`${b.traceId}\``);
  }

  // 安全请求头展示
  if (b.requestHeaders && Object.keys(b.requestHeaders).length > 0) {
    const hStr = Object.entries(b.requestHeaders).map(([k, v]) => `  ${k}: ${v}`).join('\n');
    parts.push('请求头:\n' + fencedCodeBlock(hStr));
  }

  if (!b.requestBody || b.requestBody.trim() === '' || b.requestBody.trim() === '{}') {
    parts.push('请求体：空');
  } else {
    parts.push('请求体:\n' + fencedCodeBlock(b.requestBody));
  }

  if (b.responseBody && b.responseBody.trim()) {
    parts.push('响应体:\n' + fencedCodeBlock(b.responseBody));
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
