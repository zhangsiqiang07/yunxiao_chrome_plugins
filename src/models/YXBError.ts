/** 统一错误类型（对标 YXBError.swift） */
export class YXBError extends Error {
  code: string;
  statusCode?: number;
  constructor(code: string, message: string, statusCode?: number) {
    super(message);
    this.name = 'YXBError';
    this.code = code;
    this.statusCode = statusCode;
  }
  static notConfigured()                        { return new YXBError('notConfigured', '未配置 SDK，请先调用 configure()'); }
  static invalidConfiguration(msg: string)      { return new YXBError('invalidConfiguration', msg); }
  static invalidReport(msg: string)             { return new YXBError('invalidReport', msg); }
  static tokenUnavailable(msg: string)          { return new YXBError('tokenUnavailable', `获取 Token 失败: ${msg}`); }
  static workitemTypeNotFound()                 { return new YXBError('workitemTypeNotFound', '未找到可用的 Bug 工作项类型'); }
  static workitemCreationFailed(msg: string)    { return new YXBError('workitemCreationFailed', `创建工作项失败: ${msg}`); }
  static httpError(statusCode: number, msg: string) { return new YXBError('httpError', `HTTP ${statusCode}: ${msg}`, statusCode); }
  static decodingFailed(msg: string)            { return new YXBError('decodingFailed', `解码失败: ${msg}`); }
  static attachmentTooLarge(fileName: string, limit: number) {
    return new YXBError('attachmentTooLarge', `附件 ${fileName} 超过大小限制 (${(limit / 1024 / 1024).toFixed(0)} MB)`);
  }
}
