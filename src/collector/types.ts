/**
 * 收集器与上下文数据类型定义（对标 YXBBugContext.swift & YXBHostContext.swift）
 */

export interface NetworkBreadcrumb {
  id: string;
  method: string;
  path: string;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  statusCode: number | null;
  durationMs: number;
  error: string | null;
  responseHeaders: Record<string, string>;
  responseBody: string | null;
  timestamp: number;
}

export interface BugContext {
  pageTitle: string;
  pageURL: string;
  browserInfo: string;
  osInfo: string;
  viewportSize: string;
  networkStatus: string;
  screenshotCount: number;
  timestamp: number;
  recentActions: string[];
  recentRequests: NetworkBreadcrumb[];
  consoleErrors: string[];
  supplementaryInfo: Record<string, string>;
}

export interface HostContextSnapshot {
  pageTitle: string;
  pageURL: string;
  browserInfo: string;
  osInfo: string;
  viewportSize: string;
  networkStatus: string;
  timestamp: number;
  recentActions: string[];
  recentRequests: NetworkBreadcrumb[];
  consoleErrors: string[];
  supplementaryInfo: Record<string, string>;
}

// 消息通道类型
export const MSG_TYPE_SNAPSHOT_REQUEST = 'YXB_SNAPSHOT_REQUEST';
export const MSG_TYPE_SNAPSHOT_RESPONSE = 'YXB_SNAPSHOT_RESPONSE';
export const MSG_TYPE_CAPTURE_SCREENSHOT = 'YXB_CAPTURE_SCREENSHOT';
export const MSG_TYPE_SCREENSHOT_RESULT = 'YXB_SCREENSHOT_RESULT';
export const MSG_TYPE_NETWORK_BREADCRUMB = 'YXB_NETWORK_BREADCRUMB';
export const MSG_TYPE_CONSOLE_ERROR = 'YXB_CONSOLE_ERROR';
