import type { YXBConfiguration } from '../models/YXBConfiguration';
import type { YXBBugReport, YXBSubmitResult, YXBSubmitStatus } from '../models/YXBBugReport';
import { YXBError } from '../models/YXBError';
import type {
  YXBCurrentUser,
  YXBFieldDefinition,
  YXBMember,
  YXBProject,
  YXBWorkitem,
  YXBWorkitemType,
  YXBWorkflowStatus,
  YXBWorkitemFilter,
} from '../models/YXBWorkitemModels';
import { YXBAttachmentService } from './YXBAttachmentService';
import { embedAttachments } from './YXBDescriptionEmbedder';
import { YXBHTTPClient } from './YXBHTTPClient';
import { YXBWorkitemService } from './YXBWorkitemService';

/**
 * YunxiaoBugReporter 是 SDK 的公开门面（对标 YunxiaoBugReporter.swift）。
 * 
 * 编排提单流程：校验报告 → 获取 Token → 解析工作项类型（带缓存） → 创建工作项 → 上传附件 → 嵌入描述 → 汇总结果。
 * 收到 HTTP 401 时自动清空 Token 缓存并重试一次。
 */
export class YunxiaoBugReporter {
  private config?: YXBConfiguration;
  private workitemService?: YXBWorkitemService;
  private attachmentService?: YXBAttachmentService;
  private httpClient = new YXBHTTPClient();

  private static TOKEN_CACHE_KEY = 'token';

  constructor(configuration?: YXBConfiguration) {
    if (configuration) {
      this.configure(configuration);
    }
  }

  public configure(configuration: YXBConfiguration): void {
    this.validateConfiguration(configuration);
    this.config = configuration;
    this.workitemService = new YXBWorkitemService(configuration);
    this.attachmentService = new YXBAttachmentService(configuration);
  }

  private validateConfiguration(config: YXBConfiguration): void {
    if (!config.domain || !config.domain.startsWith('http')) {
      throw YXBError.invalidConfiguration('域名格式不正确，必须为 http 或 https 开头');
    }
    if (config.edition === 'standard' && (!config.organizationID || config.organizationID.trim() === '')) {
      throw YXBError.invalidConfiguration('中心版必须指定 organizationID');
    }
  }

  private validateReport(report: YXBBugReport): void {
    if (!report.title || report.title.trim() === '') {
      throw YXBError.invalidReport('Bug 标题不能为空');
    }
    for (const att of report.attachments) {
      if (att.data.size > 20 * 1024 * 1024) {
        throw YXBError.attachmentTooLarge(att.fileName, 20 * 1024 * 1024);
      }
    }
  }

  private workitemTypeCacheKey(config: YXBConfiguration): string {
    const org = config.organizationID ?? 'none';
    return `workitemType.${config.edition}.${org}.${config.projectID}`;
  }

  private async fetchToken(forceRefresh = false): Promise<string> {
    if (!this.config) throw YXBError.notConfigured();

    if (!forceRefresh && this.config.tokenCacheTTL > 0 && this.config.cache) {
      const cached = await this.config.cache.getString(YunxiaoBugReporter.TOKEN_CACHE_KEY);
      if (cached) {
        return cached;
      }
    }

    try {
      const token = await this.config.tokenProvider();
      if (!token || token.trim() === '') {
        throw new Error('Token 为空');
      }
      if (this.config.tokenCacheTTL > 0 && this.config.cache) {
        await this.config.cache.setString(token, YunxiaoBugReporter.TOKEN_CACHE_KEY, this.config.tokenCacheTTL);
      }
      return token;
    } catch (err) {
      throw YXBError.tokenUnavailable(err instanceof Error ? err.message : String(err));
    }
  }

  private async resolveWorkitemTypeID(token: string): Promise<string> {
    if (!this.config || !this.workitemService) throw YXBError.notConfigured();

    if (this.config.workitemTypeID && this.config.workitemTypeID.trim() !== '') {
      return this.config.workitemTypeID;
    }

    const key = this.workitemTypeCacheKey(this.config);
    if (this.config.cache) {
      const cached = await this.config.cache.getString(key);
      if (cached) return cached;
    }

    const types = await this.workitemService.fetchBugTypes(token);
    // 自动选择策略：category 为 Bug，优先 default，其次首个启用的类型
    const bugTypes = types.filter(t => (t.category || '').toLowerCase() === 'bug');
    const selected = bugTypes.find(t => t.isDefault && t.enabled !== false) ||
                     bugTypes.find(t => t.enabled !== false) ||
                     bugTypes[0] ||
                     types[0];

    if (!selected || !selected.id) {
      throw YXBError.workitemTypeNotFound();
    }

    if (this.config.cache) {
      await this.config.cache.setString(selected.id, key, this.config.workitemTypeCacheTTL);
    }
    return selected.id;
  }

  /**
   * 提交一次 Bug 上报
   */
  public async submit(report: YXBBugReport): Promise<YXBSubmitResult> {
    if (!this.config || !this.workitemService || !this.attachmentService) {
      throw YXBError.notConfigured();
    }
    this.validateReport(report);

    try {
      return await this.performSubmit(report);
    } catch (error) {
      if (error instanceof YXBError && error.statusCode === 401) {
        console.warn('[YunxiaoBugReporter] 收到 401，疑似 Token 失效或已更换，清空 Token 缓存后重试一次');
        if (this.config.cache) {
          await this.config.cache.remove(YunxiaoBugReporter.TOKEN_CACHE_KEY);
        }
        return await this.performSubmit(report, true);
      }
      throw error;
    }
  }

  private async performSubmit(report: YXBBugReport, forceRefresh = false): Promise<YXBSubmitResult> {
    const projId = (this.config?.projectID ?? '').trim();
    if (!projId || projId === 'PLACEHOLDER_NOT_USED') {
      throw YXBError.invalidConfiguration('未指定所属项目 ID，请先选择或输入项目 ID');
    }

    const token = await this.fetchToken(forceRefresh);
    const workitemTypeID = await this.resolveWorkitemTypeID(token);

    const workitemID = await this.workitemService!.createWorkitem(report, workitemTypeID, token);

    if (report.attachments.length === 0) {
      return {
        workitemID,
        status: 'success',
        successfulAttachments: [],
        failedAttachments: [],
      };
    }

    const attachmentResults = await this.attachmentService!.uploadAll(report.attachments, workitemID, token);
    const failed = attachmentResults.filter(r => !r.success);
    const successful = attachmentResults.filter(r => r.success);
    const status: YXBSubmitStatus = failed.length === 0 ? 'success' : 'partialSuccess';

    // 成功附件图片片段自动嵌入工作项描述
    const embedded = embedAttachments(attachmentResults, report.format, report.description);
    if (embedded) {
      try {
        await this.workitemService!.updateWorkitemDescription(workitemID, embedded, report.format, token);
      } catch (err) {
        console.warn('[YunxiaoBugReporter] 嵌入图片到描述失败（附件已存在，可忽略）:', err);
      }
    }

    return {
      workitemID,
      status,
      successfulAttachments: successful,
      failedAttachments: failed,
    };
  }

  /**
   * 通用 401 自动重试包装器
   */
  private async withRetry<T>(action: (token: string) => Promise<T>): Promise<T> {
    if (!this.config) throw YXBError.notConfigured();
    try {
      const token = await this.fetchToken(false);
      return await action(token);
    } catch (error) {
      if (error instanceof YXBError && error.statusCode === 401) {
        if (this.config.cache) {
          await this.config.cache.remove(YunxiaoBugReporter.TOKEN_CACHE_KEY);
        }
        const refreshedToken = await this.fetchToken(true);
        return await action(refreshedToken);
      }
      throw error;
    }
  }

  public async getCurrentUser(): Promise<YXBCurrentUser> {
    if (!this.workitemService) throw YXBError.notConfigured();
    return this.withRetry(token => this.workitemService!.fetchCurrentUser(token));
  }

  public async listBugTypes(): Promise<YXBWorkitemType[]> {
    if (!this.workitemService) throw YXBError.notConfigured();
    return this.withRetry(token => this.workitemService!.fetchBugTypes(token));
  }

  public async listProjectMembers(): Promise<YXBMember[]> {
    if (!this.workitemService) throw YXBError.notConfigured();
    return this.withRetry(token => this.workitemService!.fetchProjectMembers(token));
  }

  public async listOrganizationProjects(keyword?: string): Promise<YXBProject[]> {
    if (!this.workitemService) throw YXBError.notConfigured();
    return this.withRetry(token => this.workitemService!.fetchOrganizationProjects(token, keyword));
  }

  public async listWorkitemTypeFields(workitemTypeID: string): Promise<YXBFieldDefinition[]> {
    if (!this.workitemService) throw YXBError.notConfigured();
    return this.withRetry(token => this.workitemService!.fetchTypeFields(workitemTypeID, token));
  }

  public async listWorkitems(
    page = 1,
    perPage = 20,
    category = 'Bug',
    filter?: YXBWorkitemFilter,
  ): Promise<YXBWorkitem[]> {
    if (!this.workitemService) throw YXBError.notConfigured();
    return this.withRetry(token => this.workitemService!.fetchWorkitems(page, perPage, category, token, filter));
  }

  public async getWorkitem(workitemID: string): Promise<YXBWorkitem> {
    if (!this.workitemService) throw YXBError.notConfigured();
    return this.withRetry(token => this.workitemService!.fetchWorkitem(workitemID, token));
  }

  public async updateWorkitemDescription(workitemID: string, description: string, format: any = 'plainText'): Promise<void> {
    if (!this.workitemService) throw YXBError.notConfigured();
    return this.withRetry(token => this.workitemService!.updateWorkitemDescription(workitemID, description, format, token));
  }

  public async downloadWorkitemFile(fileIdentifier: string, workitemID: string): Promise<ArrayBuffer> {
    if (!this.workitemService) throw YXBError.notConfigured();
    const tempURL = await this.withRetry(token => this.workitemService!.fetchWorkitemFileURL(workitemID, fileIdentifier, token));
    return this.httpClient.download(tempURL);
  }

  public async downloadImage(url: string): Promise<ArrayBuffer> {
    return this.withRetry(token => this.httpClient.download(url, token));
  }

  public async listWorkflowStatuses(workitemTypeId?: string, workitemId?: string): Promise<YXBWorkflowStatus[]> {
    if (!this.workitemService) throw YXBError.notConfigured();
    return this.withRetry(async (token) => {
      let typeId = workitemTypeId || this.config?.workitemTypeID;
      if (!typeId) {
        try {
          typeId = await this.resolveWorkitemTypeID(token);
        } catch {
          // ignore
        }
      }
      return this.workitemService!.fetchWorkflowStatuses(typeId, workitemId, token);
    });
  }

  public async updateWorkitemStatus(
    workitemId: string,
    statusIdOrName: string,
    alternativeValue?: string,
  ): Promise<void> {
    if (!this.workitemService) throw YXBError.notConfigured();
    return this.withRetry(token =>
      this.workitemService!.updateWorkitemStatus(workitemId, statusIdOrName, token, alternativeValue)
    );
  }
}
