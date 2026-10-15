/** 问题类型（对标 YXBIssueType） */
export interface IssueTypeItem { id: string; rawValue: string; displayName: string; label: string; }
export const ISSUE_TYPES: IssueTypeItem[] = [
  { id: 'ui',       rawValue: 'ui',       displayName: 'UI',   label: '问题类型:ui' },
  { id: 'function', rawValue: 'function', displayName: '功能', label: '问题类型:function' },
  { id: 'crash',    rawValue: 'crash',    displayName: '崩溃', label: '问题类型:crash' },
  { id: 'lag',      rawValue: 'lag',      displayName: '卡顿', label: '问题类型:lag' },
  { id: 'network',  rawValue: 'network',  displayName: '网络', label: '问题类型:network' },
  { id: 'data',     rawValue: 'data',     displayName: '数据', label: '问题类型:data' },
];

/** 严重程度（对标 YXBSeverity） */
export interface SeverityItem { id: string; rawValue: string; displayName: string; label: string; }
export const SEVERITIES: SeverityItem[] = [
  { id: 'blocker',  rawValue: 'blocker',  displayName: '阻塞', label: '严重程度:blocker' },
  { id: 'critical', rawValue: 'critical', displayName: '严重', label: '严重程度:critical' },
  { id: 'major',    rawValue: 'major',    displayName: '一般', label: '严重程度:major' },
  { id: 'minor',    rawValue: 'minor',    displayName: '建议', label: '严重程度:minor' },
];

/** 发生频率（对标 YXBFrequency） */
export interface FrequencyItem { id: string; rawValue: string; displayName: string; label: string; }
export const FREQUENCIES: FrequencyItem[] = [
  { id: 'always',    rawValue: 'always',    displayName: '必现',     label: '发生频率:always' },
  { id: 'sometimes', rawValue: 'sometimes', displayName: '偶现',     label: '发生频率:sometimes' },
  { id: 'first',     rawValue: 'first',     displayName: '首次出现', label: '发生频率:first' },
];
