import type { YXBConfiguration } from '../models/YXBConfiguration';
import { descriptionFormatApiValue, type YXBDescriptionFormat } from '../models/YXBConfiguration';
import type { YXBBugReport } from '../models/YXBBugReport';
import type {
  YXBWorkitemType, YXBMember, YXBProject, YXBCurrentUser,
  YXBWorkitem, YXBFieldDefinition,
} from '../models/YXBWorkitemModels';
import { YXBHTTPClient } from './YXBHTTPClient';

/**
 * 工作项服务（对标 YXBWorkitemService.swift）
 */
export class YXBWorkitemService {
  private client = new YXBHTTPClient();

  constructor(private config: YXBConfiguration) {}

  async fetchCurrentUser(token: string): Promise<YXBCurrentUser> {
    return this.client.send<YXBCurrentUser>(this.config, { kind: 'currentUser' }, 'GET', token);
  }

  async fetchBugTypes(token: string): Promise<YXBWorkitemType[]> {
    const resp = await this.client.send<any>(
      this.config, { kind: 'workitemTypes' }, 'GET', token, { category: 'Bug' },
    );
    return (resp.workitemTypes ?? resp.items ?? resp.result ?? []) as YXBWorkitemType[];
  }

  async fetchTypeFields(workitemTypeId: string, token: string): Promise<YXBFieldDefinition[]> {
    const resp = await this.client.send<any>(
      this.config, { kind: 'workitemTypeFields', workitemTypeId }, 'GET', token,
    );
    return (resp.fields ?? resp.items ?? resp.result ?? []) as YXBFieldDefinition[];
  }

  async fetchProjectMembers(token: string): Promise<YXBMember[]> {
    const resp = await this.client.send<any>(
      this.config, { kind: 'projectMembers' }, 'GET', token,
    );
    return (resp.members ?? resp.items ?? resp.result ?? []) as YXBMember[];
  }

  async fetchOrganizationProjects(token: string): Promise<YXBProject[]> {
    const resp = await this.client.send<any>(
      this.config, { kind: 'projects' }, 'POST', token, undefined,
      { orderBy: 'gmtCreate', page: 1, perPage: 50, sort: 'desc' },
    );
    const items = (resp.projects ?? resp.items ?? resp.result ?? []) as YXBProject[];
    return items.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }

  async fetchWorkitems(page: number, perPage: number, category: string, token: string): Promise<YXBWorkitem[]> {
    const resp = await this.client.send<any>(
      this.config, { kind: 'workitemsSearch' }, 'POST', token, undefined,
      {
        category, spaceId: this.config.projectID, spaceType: 'Project',
        orderBy: 'gmtCreate', page, perPage, sort: 'desc',
      },
    );
    return (resp.workitems ?? resp.items ?? resp.result ?? []) as YXBWorkitem[];
  }

  async createWorkitem(report: YXBBugReport, workitemTypeID: string, token: string): Promise<string> {
    const body: Record<string, unknown> = {
      spaceId: this.config.projectID,
      workitemTypeId: workitemTypeID,
      subject: report.title,
      assignedTo: report.assignedTo ?? this.config.assignedTo,
      description: report.description,
      descriptionFormat: descriptionFormatApiValue(report.format),
    };
    if (Object.keys(report.customFields).length > 0) {
      body.customFieldValues = report.customFields;
    }
    if (report.labels.length > 0) {
      body.labels = report.labels;
    }
    const resp = await this.client.send<any>(
      this.config, { kind: 'createWorkitem' }, 'POST', token, undefined, body,
    );
    return resp.workitemId ?? resp.id ?? resp.identifier ?? '';
  }

  async updateWorkitemDescription(
    workitemID: string, description: string, format: YXBDescriptionFormat, token: string,
  ): Promise<void> {
    await this.client.sendNoContent(
      this.config, { kind: 'updateWorkitem', workitemId: workitemID }, 'PUT', token,
      { description, formatType: descriptionFormatApiValue(format) },
    );
  }

  async fetchWorkitem(workitemID: string, token: string): Promise<YXBWorkitem> {
    const resp = await this.client.send<any>(
      this.config, { kind: 'getWorkitem', workitemId: workitemID }, 'GET', token,
    );
    return (resp.workitem ?? resp.data ?? resp.result ?? resp) as YXBWorkitem;
  }

  async fetchWorkitemFileURL(workitemId: string, fileId: string, token: string): Promise<string> {
    const resp = await this.client.send<any>(
      this.config, { kind: 'getWorkitemFile', workitemId, fileId }, 'GET', token,
    );
    return resp.url ?? '';
  }
}
