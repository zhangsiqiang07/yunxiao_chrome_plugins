import type { YXBCache } from '../core/YXBCache';

/** 云效版本：中心版 / Region 版 */
export type Edition = 'standard' | 'region';

/** SDK 配置（对标 YXBConfiguration.swift） */
export interface YXBConfiguration {
  domain: string;
  edition: Edition;
  organizationID?: string;
  projectID: string;
  assignedTo: string;
  workitemTypeID?: string;
  tokenProvider: () => Promise<string>;
  cache?: YXBCache;
  workitemTypeCacheTTL: number;  // 秒，默认 3600
  tokenCacheTTL: number;         // 秒，默认 300
  timeout?: number;
}

/** 描述格式 */
export type YXBDescriptionFormat = 'plainText' | 'markdown';

export function descriptionFormatApiValue(f: YXBDescriptionFormat): string {
  return f === 'markdown' ? 'MARKDOWN' : 'RICHTEXT';
}
