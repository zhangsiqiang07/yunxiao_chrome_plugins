import type { YXBConfiguration } from '../models/YXBConfiguration';
import type { YXBAttachment, YXBAttachmentResult } from '../models/YXBBugReport';
import { YXBHTTPClient } from './YXBHTTPClient';

/**
 * 附件上传服务（对标 YXBAttachmentService.swift）
 * 并发上传，单个失败不影响其他。
 */
export class YXBAttachmentService {
  private client = new YXBHTTPClient();

  constructor(private config: YXBConfiguration) {}

  async uploadAll(
    attachments: YXBAttachment[],
    workitemID: string,
    token: string,
    maxConcurrent = 2,
  ): Promise<YXBAttachmentResult[]> {
    const results: YXBAttachmentResult[] = new Array(attachments.length);
    let cursor = 0;

    const next = async (): Promise<void> => {
      while (cursor < attachments.length) {
        const idx = cursor++;
        results[idx] = await this.uploadOne(attachments[idx], workitemID, token);
      }
    };

    const workers = Array.from({ length: Math.min(maxConcurrent, attachments.length) }, () => next());
    await Promise.all(workers);
    return results;
  }

  private async uploadOne(
    attachment: YXBAttachment,
    workitemID: string,
    token: string,
  ): Promise<YXBAttachmentResult> {
    try {
      const formData = new FormData();
      formData.append('file', attachment.data, attachment.fileName);
      const resp = await this.client.sendFormData(
        this.config,
        { kind: 'attachments', workitemId: workitemID },
        token,
        formData,
      );
      return {
        fileName: attachment.fileName,
        success: true,
        embedMarkdown: resp.embedMarkdown ?? undefined,
        embedHTML: resp.embedHtml ?? resp.embedHTML ?? undefined,
        embedURL: resp.embedUrl ?? resp.embedURL ?? undefined,
      };
    } catch (err) {
      return {
        fileName: attachment.fileName,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
