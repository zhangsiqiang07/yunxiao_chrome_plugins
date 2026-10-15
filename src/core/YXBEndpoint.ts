import type { YXBConfiguration } from '../models/YXBConfiguration';

/** API 端点类型 */
export type EndpointType =
  | { kind: 'currentUser' }
  | { kind: 'workitemTypes' }
  | { kind: 'workitemTypeFields'; workitemTypeId: string }
  | { kind: 'createWorkitem' }
  | { kind: 'projectMembers' }
  | { kind: 'projects' }
  | { kind: 'workitemsSearch' }
  | { kind: 'attachments'; workitemId: string }
  | { kind: 'updateWorkitem'; workitemId: string }
  | { kind: 'getWorkitem'; workitemId: string }
  | { kind: 'getWorkitemFile'; workitemId: string; fileId: string };

function base(config: YXBConfiguration): string {
  if (config.edition === 'standard') {
    const org = (config.organizationID ?? '').trim();
    return `/oapi/v1/projex/organizations/${org}`;
  }
  return '/oapi/v1/projex';
}

/** 生成 API 路径（不含域名、不含 query） */
export function endpointPath(ep: EndpointType, config: YXBConfiguration): string {
  const proj = (config.projectID ?? '').trim();
  switch (ep.kind) {
    case 'currentUser':
      return '/oapi/v1/platform/user';
    case 'workitemTypes':
      return `${base(config)}/projects/${proj}/workitemTypes`;
    case 'workitemTypeFields':
      return `${base(config)}/projects/${proj}/workitemTypes/${ep.workitemTypeId}/fields`;
    case 'createWorkitem':
      return `${base(config)}/workitems`;
    case 'projectMembers':
      return `${base(config)}/projects/${proj}/members`;
    case 'projects':
      return `${base(config)}/projects:search`;
    case 'workitemsSearch':
      return `${base(config)}/workitems:search`;
    case 'attachments':
      return `${base(config)}/workitems/${ep.workitemId}/attachments`;
    case 'updateWorkitem':
      return `${base(config)}/workitems/${ep.workitemId}`;
    case 'getWorkitem':
      return `${base(config)}/workitems/${ep.workitemId}`;
    case 'getWorkitemFile':
      return `${base(config)}/workitems/${ep.workitemId}/files/${ep.fileId}`;
  }
}
