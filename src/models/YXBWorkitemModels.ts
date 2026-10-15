/** 工作项类型 */
export interface YXBWorkitemType {
  id: string;
  name?: string;
  category?: string;
  isDefault?: boolean;
  enabled?: boolean;
}

/** 项目成员 */
export interface YXBMember {
  id: string;
  name: string;
}

/** 项目 */
export interface YXBProject {
  id: string;
  name: string;
  createdAt?: number; // 毫秒时间戳
  customCode?: string;
  logicalStatus?: string;
}

/** 当前 Token 对应用户 */
export interface YXBCurrentUser {
  id: string;
  name: string;
  username?: string;
  aliyunPk?: string;
}

export function tokenUserDescription(u: YXBCurrentUser): string {
  if (u.name && u.username && u.name !== u.username) {
    return `${u.name}（${u.username}）`;
  }
  return u.name || u.username || u.id;
}

/** 工作项 */
export interface YXBWorkitem {
  id: string;
  subject: string;
  description?: string;
  statusName?: string;
  assignedToName?: string;
  priorityName?: string;
  severityName?: string;
  creatorName?: string;
  spaceName?: string;
  serialNumber?: string;
  gmtCreate?: number;
  gmtModified?: number;
}

/** 字段选项 */
export interface YXBFieldOption {
  id: string;
  value: string;
  displayValue: string;
}

/** 工作流状态 */
export interface YXBWorkflowStatus {
  id: string;
  name: string;
  displayName?: string;
  nameEn?: string;
  stageName?: string;
}

/** 字段定义 */
export interface YXBFieldDefinition {
  id: string;
  name: string;
  format: string;
  required: boolean;
  defaultValue?: string;
  options: YXBFieldOption[];
}

// ─── API 响应包装 ───────────────────────────────────────────

export interface YXBWorkitemTypesResponse { items: YXBWorkitemType[]; }
export interface YXBMembersResponse       { items: YXBMember[]; }
export interface YXBProjectsResponse      { items: YXBProject[]; }
export interface YXBWorkitemsResponse      { items: YXBWorkitem[]; }
export interface YXBWorkitemCreateResponse { id: string; }
export interface YXBFieldDefinitionsResponse { items: YXBFieldDefinition[]; }
export interface YXBWorkitemFileResponse   { url: string; }

/** 工作项详情响应可能嵌套在 workitem/data/result 下 */
export interface YXBWorkitemDetailResponse { item: YXBWorkitem; }
