import type { YXBAttachmentResult } from '../models/YXBBugReport';
import type { YXBDescriptionFormat } from '../models/YXBConfiguration';

/**
 * 描述嵌入器（对标 YXBDescriptionEmbedder.swift）
 * 把上传成功的图片片段追加到工作项描述中
 */
export function embedAttachments(
  attachments: YXBAttachmentResult[],
  format: YXBDescriptionFormat,
  originalDescription: string,
): string | null {
  const snippets = attachments
    .filter(a => a.success)
    .map(a => snippet(a, format))
    .filter((s): s is string => !!s && s.length > 0);
  if (snippets.length === 0) return null;
  return [originalDescription, ...snippets].join('\n');
}

function snippet(result: YXBAttachmentResult, format: YXBDescriptionFormat): string | null {
  if (!result.success) return null;
  if (format === 'markdown') {
    if (result.embedMarkdown) return result.embedMarkdown;
    if (result.embedURL) return `![image](${result.embedURL})`;
    return null;
  }
  // plainText → RICHTEXT (HTML)
  if (result.embedHTML) return result.embedHTML;
  if (result.embedURL) return `<img src="${result.embedURL}" />`;
  return null;
}
