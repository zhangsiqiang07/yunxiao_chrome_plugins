import type { YXBConfiguration } from '../models/YXBConfiguration';
import { descriptionFormatApiValue, type YXBDescriptionFormat } from '../models/YXBConfiguration';
import type { YXBBugReport } from '../models/YXBBugReport';
import type {
  YXBWorkitemType, YXBMember, YXBProject, YXBCurrentUser,
  YXBWorkitem, YXBFieldDefinition,
} from '../models/YXBWorkitemModels';
import { YXBHTTPClient } from './YXBHTTPClient';

/**
 * 容错提取数组列表（兼容直接数组 / data / items / projects / members / workitems / list / result 等）
 */
function extractList<T = any>(resp: any, ...keys: string[]): T[] {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  for (const k of keys) {
    if (Array.isArray(resp[k])) return resp[k];
    if (resp[k] && typeof resp[k] === 'object') {
      if (Array.isArray(resp[k].items)) return resp[k].items;
      if (Array.isArray(resp[k].list)) return resp[k].list;
      if (Array.isArray(resp[k].data)) return resp[k].data;
      if (Array.isArray(resp[k].result)) return resp[k].result;
      if (Array.isArray(resp[k].projects)) return resp[k].projects;
      if (Array.isArray(resp[k].members)) return resp[k].members;
      if (Array.isArray(resp[k].workitems)) return resp[k].workitems;
    }
  }
  if (Array.isArray(resp.items)) return resp.items;
  if (Array.isArray(resp.list)) return resp.list;
  if (Array.isArray(resp.data)) return resp.data;
  if (Array.isArray(resp.result)) return resp.result;
  if (Array.isArray(resp.projects)) return resp.projects;
  if (Array.isArray(resp.members)) return resp.members;
  if (Array.isArray(resp.workitems)) return resp.workitems;
  if (Array.isArray(resp.records)) return resp.records;
  return [];
}

/**
 * 容错标准化项目模型（云效返回的标识可能是 identifier / id / projectId 等）
 */
function normalizeProject(item: any): YXBProject {
  if (!item) return { id: '', name: '' };
  const id = item.id || item.identifier || item.projectId || item.projectIdentifier || item.spaceId || item.spaceIdentifier || '';
  const name = item.name || item.nameCn || item.displayName || item.projectName || item.subject || id;
  let createdAt: number | undefined;
  if (typeof item.gmtCreate === 'number') {
    createdAt = item.gmtCreate;
  } else if (typeof item.gmtCreate === 'string' && item.gmtCreate) {
    const num = Number(item.gmtCreate);
    if (!isNaN(num)) createdAt = num;
  } else if (typeof item.createdAt === 'number') {
    createdAt = item.createdAt;
  } else if (typeof item.createdAt === 'string' && item.createdAt) {
    const num = Number(item.createdAt);
    if (!isNaN(num)) createdAt = num;
  }
  return {
    id: String(id),
    name: String(name),
    createdAt,
    customCode: item.customCode,
    logicalStatus: item.logicalStatus,
  };
}

/**
 * 容错标准化成员模型
 */
function normalizeMember(item: any): YXBMember {
  if (!item) return { id: '', name: '' };
  const id = item.id || item.identifier || item.userId || item.userIdentifier || item.accountId || item.account || '';
  const name = item.displayName || item.userName || item.displayRealName || item.displayNickName || item.name || item.realName || item.nickName || item.nickname || item.account || item.loginName || id;
  return { id: String(id), name: String(name) };
}

/**
 * 容错标准化工作项类型模型
 */
function normalizeWorkitemType(item: any): YXBWorkitemType {
  if (!item) return { id: '', name: '' };
  const id = item.id || item.identifier || item.workitemTypeId || item.typeId || '';
  const name = item.name || item.nameCn || item.displayName || '';
  const category = item.category || '';
  const enabled = item.enabled !== false;
  const isDefault = Boolean(item.isDefault || item.defaultType);
  return { id: String(id), name: String(name), category, enabled, isDefault };
}

/**
 * 容错标准化工作项模型
 */
function normalizeWorkitem(item: any): YXBWorkitem {
  if (!item) return { id: '', subject: '' };
  const id = item.identifier || item.id || item.workitemId || item.workitemIdentifier || '';
  const subject = item.subject || item.title || item.name || '';
  
  const resolveName = (val: any): string | undefined => {
    if (!val) return undefined;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return val.displayName || val.name || val.resolved || undefined;
    return undefined;
  };

  const statusName = resolveName(item.status) || item.statusName;
  const assignedToName = resolveName(item.assignedTo) || item.assignedToName;
  const priorityName = resolveName(item.priority) || item.priorityName;
  const severityName = resolveName(item.severity) || item.severityName;
  const creatorName = resolveName(item.creator) || item.creatorName;
  const spaceName = resolveName(item.space) || resolveName(item.project) || item.spaceName;

  let gmtCreate: number | undefined;
  if (typeof item.gmtCreate === 'number') gmtCreate = item.gmtCreate;
  else if (item.gmtCreate) { const n = Number(item.gmtCreate); if (!isNaN(n)) gmtCreate = n; }

  let gmtModified: number | undefined;
  if (typeof item.gmtModified === 'number') gmtModified = item.gmtModified;
  else if (item.gmtModified) { const n = Number(item.gmtModified); if (!isNaN(n)) gmtModified = n; }

  return {
    id: String(id),
    subject: String(subject),
    statusName,
    assignedToName,
    priorityName,
    severityName,
    creatorName,
    spaceName,
    description: item.description,
    serialNumber: item.serialNumber,
    gmtCreate,
    gmtModified,
  };
}

/**
 * 工作项服务（对标 YXBWorkitemService.swift）
 */
export class YXBWorkitemService {
  private client = new YXBHTTPClient();

  constructor(private config: YXBConfiguration) {}

  async fetchCurrentUser(token: string): Promise<YXBCurrentUser> {
    const resp = await this.client.send<any>(this.config, { kind: 'currentUser' }, 'GET', token);
    const data = resp.data || resp.result || resp.user || resp;
    return {
      id: data.id || data.identifier || data.userId || data.aliyunPk || '',
      name: data.displayName || data.name || data.username || data.loginName || data.id || '',
      username: data.username || data.loginName || '',
      aliyunPk: data.aliyunPk || '',
    };
  }

  async fetchBugTypes(token: string): Promise<YXBWorkitemType[]> {
    const resp = await this.client.send<any>(
      this.config, { kind: 'workitemTypes' }, 'GET', token, { category: 'Bug' },
    );
    const list = extractList(resp, 'workitemTypes', 'data', 'items', 'result', 'list');
    return list.map(normalizeWorkitemType).filter(t => t.id);
  }

  async fetchTypeFields(workitemTypeId: string, token: string): Promise<YXBFieldDefinition[]> {
    const resp = await this.client.send<any>(
      this.config, { kind: 'workitemTypeFields', workitemTypeId }, 'GET', token,
    );
    const list = extractList(resp, 'fields', 'data', 'items', 'result');
    return list.map((f: any) => ({
      id: f.id || f.identifier || '',
      name: f.name || f.displayName || '',
      format: f.format || '',
      type: f.type || '',
      required: Boolean(f.required),
      showWhenCreate: f.showWhenCreate !== false,
      defaultValue: f.defaultValue,
      options: (f.options || []).map((o: any) => ({
        id: o.id || o.value || '',
        value: o.value || o.id || '',
        displayValue: o.displayValue || o.value || o.name || '',
      })),
    })).filter((f: any) => f.id);
  }

  async fetchProjectMembers(token: string): Promise<YXBMember[]> {
    const resp = await this.client.send<any>(
      this.config, { kind: 'projectMembers' }, 'GET', token,
    );
    const list = extractList(resp, 'members', 'data', 'items', 'list', 'projectMembers', 'result');
    return list.map(normalizeMember).filter(m => m.id);
  }

  async fetchOrganizationProjects(token: string, keyword?: string): Promise<YXBProject[]> {
    const body: Record<string, any> = {
      orderBy: 'gmtCreate',
      page: 1,
      perPage: 100,
      sort: 'desc',
    };
    if (keyword && keyword.trim()) {
      body.name = keyword.trim();
      body.keyword = keyword.trim();
    }
    const resp = await this.client.send<any>(
      this.config, { kind: 'projects' }, 'POST', token, undefined, body,
    );
    const rawList = extractList(resp, 'projects', 'data', 'items', 'list', 'result', 'records');
    const items = rawList.map(normalizeProject).filter(p => p.id);
    return items.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }

  async fetchWorkitems(page: number, perPage: number, category: string, token: string): Promise<YXBWorkitem[]> {
    const resp = await this.client.send<any>(
      this.config, { kind: 'workitemsSearch' }, 'POST', token, undefined,
      {
        category, spaceId: (this.config.projectID ?? '').trim(), spaceType: 'Project',
        orderBy: 'gmtCreate', page, perPage, sort: 'desc',
      },
    );
    const list = extractList(resp, 'workitems', 'data', 'items', 'list', 'result');
    return list.map(normalizeWorkitem).filter(w => w.id);
  }

  async createWorkitem(report: YXBBugReport, workitemTypeID: string, token: string): Promise<string> {
    const body: Record<string, unknown> = {
      spaceId: (this.config.projectID ?? '').trim(),
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
    return resp.workitemId ?? resp.id ?? resp.identifier ?? resp.workItemId ?? '';
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
    const data = resp.workitem ?? resp.data ?? resp.result ?? resp;
    return normalizeWorkitem(data);
  }

  async fetchWorkitemFileURL(workitemId: string, fileId: string, token: string): Promise<string> {
    const resp = await this.client.send<any>(
      this.config, { kind: 'getWorkitemFile', workitemId, fileId }, 'GET', token,
    );
    return resp.url ?? (resp.data?.url) ?? '';
  }
}
