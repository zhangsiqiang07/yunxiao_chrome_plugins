import type { YXBDescriptionFormat } from './YXBConfiguration';

/** 附件 */
export interface YXBAttachment {
  data: Blob;
  fileName: string;
  mimeType: string;
}

/** Bug 报告 */
export interface YXBBugReport {
  title: string;
  description: string;
  format: YXBDescriptionFormat;
  customFields: Record<string, string>;
  labels: string[];
  attachments: YXBAttachment[];
  assignedTo?: string;
}

/** 提交状态 */
export type YXBSubmitStatus = 'success' | 'partialSuccess';

/** 单个附件上传结果 */
export interface YXBAttachmentResult {
  fileName: string;
  success: boolean;
  error?: string;
  embedMarkdown?: string;
  embedHTML?: string;
  embedURL?: string;
}

/** 提交结果 */
export interface YXBSubmitResult {
  workitemID: string;
  status: YXBSubmitStatus;
  successfulAttachments: YXBAttachmentResult[];
  failedAttachments: YXBAttachmentResult[];
}
