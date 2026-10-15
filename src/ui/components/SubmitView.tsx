import React, { useEffect, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clipboard,
  FileUp,
  HelpCircle,
  Plus,
  RefreshCw,
  Sparkles,
  UploadCloud,
  X,
  AlertTriangle,
  Info,
} from 'lucide-react';
import {
  MSG_TYPE_CAPTURE_SCREENSHOT,
  MSG_TYPE_SNAPSHOT_REQUEST,
  type BugContext,
  type HostContextSnapshot,
} from '../../collector/types';
import { compose } from '../../core/YXBDescriptionComposer';
import { YXBRemoteBugAIFormatter } from '../../core/YXBRemoteBugAIFormatter';
import { YunxiaoBugReporter } from '../../core/YunxiaoBugReporter';
import {
  FREQUENCIES,
  ISSUE_TYPES,
  SEVERITIES,
} from '../../models/YXBBugCategorization';
import type { YXBAttachment, YXBBugReport, YXBSubmitResult } from '../../models/YXBBugReport';
import type {
  YXBCurrentUser,
  YXBFieldDefinition,
  YXBMember,
  YXBProject,
} from '../../models/YXBWorkitemModels';
import { useConfigStore } from '../store/useConfigStore';
import { ChipGroup } from './ChipGroup';
import {
  bakeAnnotations,
  ImageAnnotatorModal,
  type ImageAnnotation,
} from './ImageAnnotatorModal';

interface ScreenshotItem {
  id: string;
  dataUrl: string;
  annotations: ImageAnnotation[];
}

export const SubmitView: React.FC = () => {
  const store = useConfigStore();

  // 1. 状态与配置状态
  const [configStatus, setConfigStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [currentUser, setCurrentUser] = useState<YXBCurrentUser | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // 2. 项目与成员
  const [projectOptions, setProjectOptions] = useState<YXBProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectInputMode, setProjectInputMode] = useState<'select' | 'manual'>('select');
  const [manualProjectInput, setManualProjectInput] = useState(store.projectID);
  const [projectSuccessMsg, setProjectSuccessMsg] = useState<string | null>(null);
  const [memberOptions, setMemberOptions] = useState<YXBMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // 3. 描述与分类
  const [userDescription, setUserDescription] = useState('');
  const [issueType, setIssueType] = useState<string | null>('function');
  const [severity, setSeverity] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<string | null>('always');

  // 4. AI 智能整理状态
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [aiReportDetails, setAiReportDetails] = useState<{
    problem?: string;
    steps?: string;
    expected?: string;
  } | null>(null);
  const [isFormattingWithAI, setIsFormattingWithAI] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiFailed, setAiFailed] = useState(false);
  const [showFullEditor, setShowFullEditor] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [aiServiceInput, setAiServiceInput] = useState(store.aiServiceDomain);

  // 5. 截图与标注
  const [images, setImages] = useState<ScreenshotItem[]>([]);
  const [activeAnnotateItem, setActiveAnnotateItem] = useState<ScreenshotItem | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // 6. 云效动态必填字段
  const [fieldDefinitions, setFieldDefinitions] = useState<YXBFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [loadingFields, setLoadingFields] = useState(false);

  // 7. 环境与上下文快照
  const [snapshot, setSnapshot] = useState<HostContextSnapshot | null>(null);
  const [showSupplementary, setShowSupplementary] = useState(false);
  const [showEnvDisclosure, setShowEnvDisclosure] = useState(false);

  // 8. 提交状态
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    details?: YXBSubmitResult;
  } | null>(null);

  // 检查初始化环境与 Token 校验
  const loadInitial = async () => {
    setConfigStatus('checking');
    setConfigError(null);
    try {
      const reporter = new YunxiaoBugReporter(store.buildConfigurationForProjectListing());
      const user = await reporter.getCurrentUser();
      setCurrentUser(user);
      setConfigStatus('valid');
      await loadProjects(true);
    } catch (err: any) {
      setConfigStatus('invalid');
      setConfigError(err.message || '配置校验失败');
    }
  };

  // 加载组织项目列表
  const loadProjects = async (silent = false) => {
    setLoadingProjects(true);
    setProjectError(null);
    try {
      const reporter = new YunxiaoBugReporter(store.buildConfigurationForProjectListing());
      const projects = await reporter.listOrganizationProjects();
      setProjectOptions(projects);
      let targetProjectId = store.projectID.trim();

      // 默认选中组织内最新建立的项目（如果尚未设置项目且接口返回了项目）
      if (!targetProjectId && projects.length > 0) {
        targetProjectId = projects[0].id;
        store.setField('projectID', targetProjectId);
        setManualProjectInput(targetProjectId);
        await store.save();
      }

      if (targetProjectId) {
        loadMembers(targetProjectId);
        loadFields(targetProjectId);
      } else if (projects.length === 0) {
        // 如果列表为空，自动切换到手动输入模式
        setProjectInputMode('manual');
      }
    } catch (err: any) {
      const msg = err.message || '获取项目列表失败';
      setProjectError(msg);
      // 接口失败时自动切换到手动输入模式，允许用户直接指定项目
      setProjectInputMode('manual');
      if (!silent) console.warn('[SubmitView] 加载项目失败:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleProjectChange = async (newProjId: string) => {
    const trimmed = (newProjId || '').trim();
    store.setField('projectID', trimmed);
    setManualProjectInput(trimmed);
    await store.save();
    if (trimmed) {
      loadMembers(trimmed);
      loadFields(trimmed);
      setProjectSuccessMsg(`已指定项目: ${trimmed}`);
      setTimeout(() => setProjectSuccessMsg(null), 3000);
    } else {
      setMemberOptions([]);
      setFieldDefinitions([]);
    }
  };

  const loadMembers = async (overrideProjId?: string) => {
    const projId = (overrideProjId || store.projectID || '').trim();
    if (!projId || projId === 'PLACEHOLDER_NOT_USED') return;
    setLoadingMembers(true);
    try {
      const reporter = new YunxiaoBugReporter(store.buildConfigurationForMemberListing(projId));
      const members = await reporter.listProjectMembers();
      setMemberOptions(members);
      if (store.assignedTo) {
        const found = members.find(m => m.id === store.assignedTo);
        if (found) store.setField('assignedToName', found.name);
      }
    } catch (err) {
      console.warn('[SubmitView] 加载项目成员失败:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadFields = async (overrideProjId?: string) => {
    const projId = (overrideProjId || store.projectID || '').trim();
    if (!projId || projId === 'PLACEHOLDER_NOT_USED') return;
    setLoadingFields(true);
    try {
      const reporter = new YunxiaoBugReporter(store.buildConfiguration({ projectID: projId }));
      let typeID = store.workitemTypeID;
      if (!typeID) {
        const types = await reporter.listBugTypes();
        const selected = types.find(t => (t.category || '').toLowerCase() === 'bug') || types[0];
        if (selected) typeID = selected.id;
      }
      if (typeID) {
        const fields = await reporter.listWorkitemTypeFields(typeID);
        setFieldDefinitions(fields);
        // 填充默认值
        const defaults: Record<string, string> = {};
        for (const f of fields) {
          if (f.required && f.defaultValue) {
            const opt = f.options.find(o => o.id === f.defaultValue || o.value === f.defaultValue);
            if (opt) defaults[f.id] = opt.id;
          }
        }
        setCustomFieldValues(prev => ({ ...defaults, ...prev }));
      }
    } catch (err) {
      console.warn('[SubmitView] 加载字段定义失败:', err);
    } finally {
      setLoadingFields(false);
    }
  };

  // 请求当前活跃页面的快照
  const requestPageSnapshot = async () => {
    try {
      const resp = await chrome.runtime.sendMessage({ type: MSG_TYPE_SNAPSHOT_REQUEST });
      if (resp && resp.success && resp.data) {
        setSnapshot(resp.data);
      }
    } catch {}
  };

  // 截取当前标签页
  const captureCurrentTab = async () => {
    setIsCapturing(true);
    try {
      const resp = await chrome.runtime.sendMessage({ type: MSG_TYPE_CAPTURE_SCREENSHOT });
      if (resp && resp.success && resp.dataUrl) {
        setImages(prev => [
          ...prev,
          { id: Math.random().toString(36).slice(2), dataUrl: resp.dataUrl, annotations: [] },
        ]);
        await requestPageSnapshot();
      }
    } catch (err) {
      console.warn('[SubmitView] 截图失败:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  // 粘贴图片监听
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            if (evt.target?.result) {
              setImages(prev => [
                ...prev,
                { id: Math.random().toString(36).slice(2), dataUrl: evt.target!.result as string, annotations: [] },
              ]);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // 上传本地文件
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setImages(prev => [
            ...prev,
            { id: Math.random().toString(36).slice(2), dataUrl: evt.target!.result as string, annotations: [] },
          ]);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // 检查 pendingBugReport
  useEffect(() => {
    loadInitial();
    requestPageSnapshot();

    chrome.storage.session?.get?.(['pendingBugReport'])?.then?.((res: any) => {
      const pending = res?.pendingBugReport;
      if (pending && pending.screenshot) {
        setImages(prev => [
          ...prev,
          { id: Math.random().toString(36).slice(2), dataUrl: pending.screenshot, annotations: [] },
        ]);
        if (pending.snapshot) {
          setSnapshot(pending.snapshot);
        }
        chrome.storage.session.remove('pendingBugReport');
      }
    });
  }, []);

  useEffect(() => {
    setAiServiceInput(store.aiServiceDomain);
  }, [store.aiServiceDomain]);

  const handleSaveAIService = async () => {
    const val = aiServiceInput.trim();
    store.setField('aiServiceDomain', val);
    await store.save();
    setShowAISettings(false);
  };

  // AI 智能整理
  const handleAIFormat = async () => {
    if (!userDescription.trim()) return;
    if (!store.aiServiceDomain) {
      setShowAISettings(true);
      return;
    }
    setIsFormattingWithAI(true);
    setAiMessage(null);
    setAiFailed(false);

    try {
      const formatter = new YXBRemoteBugAIFormatter(store.aiServiceDomain);
      const res = await formatter.generate({
        description: userDescription.trim(),
        issue_type: issueType,
        severity,
        frequency: frequency === 'always' ? 'always' : frequency === 'sometimes' ? 'occasionally' : 'once',
        page: { name: snapshot?.pageTitle, route: snapshot?.pageURL },
        recent_actions: snapshot?.recentActions.slice(0, 50) || [],
        environment: {
          app_version: 'Web',
          device: snapshot?.browserInfo,
          os_version: snapshot?.osInfo,
          network: snapshot?.networkStatus,
        },
      });

      setGeneratedTitle(res.title);
      setAiReportDetails({
        problem: res.actual_result,
        steps: res.reproduction_steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n'),
        expected: res.expected_result ? (res.expected_result + (res.expected_result_inferred ? '（AI 推断）' : '')) : undefined,
      });

      // 组装结构化正文
      const sections = [`## 问题描述\n${res.actual_result}`];
      if (res.reproduction_steps.length > 0) {
        sections.push(`## 复现步骤\n${res.reproduction_steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}`);
      }
      if (res.expected_result) {
        sections.push(`## 期望结果${res.expected_result_inferred ? '（AI 推断）' : ''}\n${res.expected_result}`);
      }
      setUserDescription(sections.join('\n\n'));

      if (res.issue_type) setIssueType(res.issue_type);
      if (res.severity) setSeverity(res.severity);

      setAiMessage(
        res.missing_information.length > 0
          ? `AI 已优化；建议补充：${res.missing_information.join('、')}`
          : 'AI 已完成整理，可继续修改',
      );
    } catch (err: any) {
      setAiFailed(true);
      setAiMessage(`AI 整理失败: ${err.message}`);
    } finally {
      setIsFormattingWithAI(false);
    }
  };

  // 拼接标题: 【Web】+ 【问题类型】+ AI标题/首行描述
  const composedTitle = (() => {
    const parts = ['【Web】'];
    const currentType = ISSUE_TYPES.find(t => t.id === issueType);
    if (currentType) parts.push(`【${currentType.displayName}】`);
    if (generatedTitle.trim()) {
      parts.push(generatedTitle.trim());
    } else {
      const firstLine = userDescription.split('\n').map(s => s.trim()).find(s => s.length > 0);
      parts.push(firstLine ? firstLine.slice(0, 80) : '未命名 Bug');
    }
    return parts.join('');
  })();

  // 必填列表字段过滤
  const requiredListFields = fieldDefinitions.filter(
    f => f.required && (f.format === 'list' || f.format === 'multiList') && f.options.length > 0,
  );

  // 检查云效必填字段中是否已有「严重程度 / 优先级」类字段
  // 若已有，说明该项目工作项类型自带官方字段（如 1-致命、2-严重…），不应再重复渲染客户端预设的「严重程度」胶囊
  const hasCloudSeverityField = requiredListFields.some(f => {
    const n = f.name.toLowerCase();
    return n.includes('severity') || n.includes('严重') || n.includes('优先级') || n.includes('priority');
  });

  const requiredFieldsFilled = requiredListFields.every(
    f => !!customFieldValues[f.id] && customFieldValues[f.id].trim() !== '',
  );

  // 提交 Bug
  const handleSubmit = async () => {
    if (!userDescription.trim()) return;
    if (!store.projectID.trim()) {
      setSubmitResult({ success: false, message: '请选择或手动输入所属项目 ID 后再提交' });
      return;
    }
    if (!store.assignedTo.trim()) {
      setSubmitResult({ success: false, message: '请选择或填写负责人后再提交' });
      return;
    }
    if (!requiredFieldsFilled) {
      setShowSupplementary(true);
      const missing = requiredListFields.filter(f => !customFieldValues[f.id]).map(f => f.name).join('、');
      setSubmitResult({ success: false, message: `请补充必填字段：${missing}` });
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // 1. 组装上下文与描述
      const bugContext: BugContext = {
        pageTitle: snapshot?.pageTitle || 'Web 页面',
        pageURL: snapshot?.pageURL || window.location.href,
        browserInfo: snapshot?.browserInfo || navigator.userAgent,
        osInfo: snapshot?.osInfo || '',
        viewportSize: snapshot?.viewportSize || '',
        networkStatus: snapshot?.networkStatus || '',
        screenshotCount: images.length,
        timestamp: snapshot?.timestamp || Date.now(),
        recentActions: snapshot?.recentActions || [],
        recentRequests: snapshot?.recentRequests || [],
        consoleErrors: snapshot?.consoleErrors || [],
        supplementaryInfo: {},
      };

      const composedDesc = compose(userDescription, bugContext);

      // 2. 烘焙截图标注并转为 Blob 附件
      const attachments: YXBAttachment[] = [];
      for (let i = 0; i < images.length; i++) {
        const item = images[i];
        const blob = await bakeAnnotations(item.dataUrl, item.annotations);
        attachments.push({
          data: blob,
          fileName: `screenshot-${i + 1}.jpg`,
          mimeType: 'image/jpeg',
        });
      }

      // 3. 组装标签
      const labels: string[] = [];
      const it = ISSUE_TYPES.find(t => t.id === issueType);
      if (it) labels.push(it.label);
      if (!hasCloudSeverityField) {
        const sev = SEVERITIES.find(s => s.id === severity);
        if (sev) labels.push(sev.label);
      }
      const freq = FREQUENCIES.find(f => f.id === frequency);
      if (freq) labels.push(freq.label);

      // 4. 调用 SDK 提交
      const reporter = new YunxiaoBugReporter(store.buildConfiguration());
      const report: YXBBugReport = {
        title: composedTitle,
        description: composedDesc,
        format: 'markdown',
        customFields: customFieldValues,
        labels,
        attachments,
        assignedTo: store.assignedTo,
      };

      const result = await reporter.submit(report);
      const isSuccess = result.status === 'success';

      setSubmitResult({
        success: isSuccess,
        message: isSuccess
          ? `提交成功！工作项 ID: ${result.workitemID}`
          : `部分成功（部分附件失败）。工作项 ID: ${result.workitemID}`,
        details: result,
      });

      // 成功后清空部分草稿
      if (isSuccess) {
        setUserDescription('');
        setGeneratedTitle('');
        setImages([]);
      }
    } catch (err: any) {
      setSubmitResult({
        success: false,
        message: `提交失败: ${err.message}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto pb-16" onPaste={handlePaste}>
      {/* 1. 云效配置状态条 */}
      <div className="px-3 py-2 bg-white border-b border-slate-200">
        {configStatus === 'checking' && (
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <RefreshCw size={13} className="animate-spin text-blue-500" />
            <span>正在校验云效配置…</span>
          </div>
        )}
        {configStatus === 'valid' && currentUser && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1.5 text-emerald-700">
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              <span className="font-medium truncate max-w-[200px]">
                云效正常 · {currentUser.name || currentUser.id}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">已就绪</span>
          </div>
        )}
        {configStatus === 'invalid' && (
          <div className="flex items-center justify-between text-xs text-red-600">
            <div className="flex items-center space-x-1 truncate max-w-[220px]">
              <AlertTriangle size={14} className="shrink-0" />
              <span className="truncate">{configError || '配置异常'}</span>
            </div>
            <button
              type="button"
              onClick={loadInitial}
              className="text-blue-600 hover:underline text-[11px] shrink-0"
            >
              重试
            </button>
          </div>
        )}
      </div>

      <div className="p-3 space-y-3">
        {/* 1. 所属项目 */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-slate-800">所属项目 (Project)</label>
            <div className="flex items-center space-x-1">
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                <button
                  type="button"
                  onClick={() => setProjectInputMode('select')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                    projectInputMode === 'select'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  列表选择
                </button>
                <button
                  type="button"
                  onClick={() => setProjectInputMode('manual')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                    projectInputMode === 'manual'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  手动输入
                </button>
              </div>
              <button
                type="button"
                onClick={() => loadProjects(false)}
                disabled={loadingProjects}
                className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 text-[11px] disabled:opacity-40 ml-1"
                title="重新拉取组织项目"
              >
                <RefreshCw size={11} className={loadingProjects ? 'animate-spin' : ''} />
                <span>刷新</span>
              </button>
            </div>
          </div>

          {projectInputMode === 'select' ? (
            <div>
              {loadingProjects ? (
                <div className="flex items-center space-x-2 text-xs text-slate-400 py-2">
                  <RefreshCw size={12} className="animate-spin text-blue-500" />
                  <span>正在获取组织项目列表…</span>
                </div>
              ) : projectOptions.length > 0 ? (
                <select
                  value={store.projectID}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">-- 请选择所属项目 --</option>
                  {store.projectID && !projectOptions.some(p => p.id === store.projectID) && (
                    <option value={store.projectID}>
                      {store.projectID} (当前手动指定项目)
                    </option>
                  )}
                  {projectOptions.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.id} ({p.id})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start space-x-1.5 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    <AlertTriangle size={14} className="shrink-0 text-amber-500 mt-0.5" />
                    <div className="flex-1 text-[11px]">
                      <p className="font-medium">{projectError ? `获取失败: ${projectError}` : '未在组织下获取到项目'}</p>
                      <p className="text-amber-600 mt-0.5">可直接切换到「手动输入」填写项目 ID (spaceId)。</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProjectInputMode('manual')}
                    className="w-full py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-medium border border-blue-200 transition-colors"
                  >
                    切换到手动输入项目 ID
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex space-x-1.5">
                <input
                  type="text"
                  placeholder="输入云效项目 ID / spaceId (如 64bcde...)"
                  value={manualProjectInput}
                  onChange={(e) => setManualProjectInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleProjectChange(manualProjectInput);
                    }
                  }}
                  className="flex-1 text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleProjectChange(manualProjectInput)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg shrink-0 transition-colors"
                >
                  确定
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                💡 项目 ID 可在云效项目页面 URL 中找到（通常为 spaceId 或 identifier）。
              </p>
            </div>
          )}

          {/* 生效提示或当前状态 */}
          {projectSuccessMsg ? (
            <div className="flex items-center space-x-1 text-[11px] text-emerald-600 font-medium">
              <CheckCircle2 size={12} />
              <span>{projectSuccessMsg}</span>
            </div>
          ) : store.projectID ? (
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
              <span className="truncate">
                当前项目: <span className="font-mono text-slate-700 font-medium">{store.projectID}</span>
              </span>
              {projectOptions.find(p => p.id === store.projectID) && (
                <span className="text-slate-400 truncate max-w-[140px]">
                  {projectOptions.find(p => p.id === store.projectID)?.name}
                </span>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-amber-600 font-medium">
              * 请指定所属项目，以自动拉取项目成员与必填字段
            </div>
          )}
        </div>

        {/* 2. 负责人 */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-xs">
            <label className="font-medium text-slate-700">指派给 (负责人)</label>
            <button
              type="button"
              onClick={() => loadMembers()}
              disabled={loadingMembers || !store.projectID}
              className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 text-[11px] disabled:opacity-40"
            >
              <RefreshCw size={10} className={loadingMembers ? 'animate-spin' : ''} />
              <span>刷新成员</span>
            </button>
          </div>
          {memberOptions.length > 0 ? (
            <select
              value={store.assignedTo}
              onChange={(e) => {
                const val = e.target.value;
                store.setField('assignedTo', val);
                const m = memberOptions.find(item => item.id === val);
                if (m) store.setField('assignedToName', m.name);
              }}
              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- 请选择负责人 --</option>
              {memberOptions.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.id})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="负责人 ID"
              value={store.assignedTo}
              onChange={(e) => store.setField('assignedTo', e.target.value)}
              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          )}
        </div>

        {/* 3. 描述问题 */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">描述问题</span>
            {/* 问题类型胶囊下拉 */}
            <select
              value={issueType || ''}
              onChange={(e) => setIssueType(e.target.value || null)}
              className="text-xs py-1 px-2 bg-blue-50 text-blue-700 font-medium rounded-full border border-blue-200 focus:outline-none cursor-pointer"
            >
              <option value="">未指定类型</option>
              {ISSUE_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.displayName}</option>
              ))}
            </select>
          </div>

          {/* AI 结果摘要卡片 */}
          {generatedTitle && aiReportDetails ? (
            <div className="space-y-2 bg-purple-50/60 border border-purple-100 rounded-lg p-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-purple-700 font-medium flex items-center space-x-1">
                  <Sparkles size={13} />
                  <span>AI 结构化摘要</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowFullEditor(!showFullEditor)}
                  className="text-purple-600 hover:text-purple-800 text-[11px]"
                >
                  {showFullEditor ? '收起完整描述' : '展开编辑完整描述'}
                </button>
              </div>
              <div className="text-[11px] font-semibold text-slate-800 select-text">
                {composedTitle}
              </div>
              {aiReportDetails.problem && (
                <div className="text-slate-600 text-[11px]">
                  <span className="text-slate-400 mr-1">现象:</span>
                  <span>{aiReportDetails.problem}</span>
                </div>
              )}
            </div>
          ) : null}

          {/* 文本输入框 */}
          {(!generatedTitle || showFullEditor) && (
            <div className="space-y-1">
              <textarea
                rows={4}
                placeholder="用一句话描述你看到的问题，如：点击结算按钮后没有反应，控制台报 500 错误。"
                value={userDescription}
                onChange={(e) => setUserDescription(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans leading-relaxed resize-y"
              />
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span>支持直接粘贴剪贴板截图</span>
                <span>{userDescription.length} 字</span>
              </div>
            </div>
          )}

          {/* AI 整理区域 */}
          {showAISettings ? (
            <div className="bg-purple-50/70 border border-purple-200 rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-purple-900 flex items-center space-x-1">
                  <Sparkles size={13} className="text-purple-600" />
                  <span>配置 Bug AI 服务地址</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowAISettings(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="flex space-x-1.5">
                <input
                  type="text"
                  placeholder="https://bug-ai.example.com"
                  value={aiServiceInput}
                  onChange={(e) => setAiServiceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveAIService();
                    }
                  }}
                  className="flex-1 text-xs p-1.5 bg-white border border-purple-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleSaveAIService}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-xs font-medium shrink-0 transition-colors"
                >
                  保存
                </button>
              </div>
              <p className="text-[10px] text-purple-700/80">
                服务地址保存后将持久化缓存。接口将请求 <code>{'{URL}'}/api/v1/bug-report/generate</code>。
              </p>
            </div>
          ) : store.aiServiceDomain ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleAIFormat}
                disabled={isFormattingWithAI || !userDescription.trim()}
                className="w-full flex items-center justify-center space-x-1.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-medium shadow-xs disabled:opacity-40 transition-all"
              >
                {isFormattingWithAI ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>AI 正在分析整理…</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>{generatedTitle ? '重新 AI 优化描述' : 'AI 优化描述与步骤'}</span>
                  </>
                )}
              </button>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 px-1">
                <span className="truncate max-w-[240px]">
                  AI 服务: <span className="font-mono text-slate-600">{store.aiServiceDomain}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAiServiceInput(store.aiServiceDomain);
                    setShowAISettings(true);
                  }}
                  className="text-purple-600 hover:text-purple-700 underline text-[11px] shrink-0 ml-2"
                >
                  修改
                </button>
              </div>
              {aiMessage && (
                <p className={`text-[11px] mt-1.5 ${aiFailed ? 'text-red-600' : 'text-slate-500'}`}>
                  {aiMessage}
                </p>
              )}
            </div>
          ) : (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setAiServiceInput(store.aiServiceDomain);
                  setShowAISettings(true);
                }}
                className="w-full flex items-center justify-center space-x-1.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-dashed border-purple-300 rounded-lg text-xs font-medium transition-all"
              >
                <Sparkles size={13} className="text-purple-600" />
                <span>配置 Bug AI 服务地址（一键智能整理）</span>
              </button>
            </div>
          )}
        </div>

        {/* 4. 证据截图 */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800">证据截图 ({images.length})</span>
            <span className="text-[11px] text-slate-400">点击缩略图可红框/箭头标注</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {images.map((item, idx) => (
              <div
                key={item.id}
                className="relative group w-20 h-20 rounded-lg border border-slate-200 overflow-hidden bg-slate-100 shrink-0 cursor-pointer"
                onClick={() => setActiveAnnotateItem(item)}
              >
                <img src={item.dataUrl} alt="截图" className="w-full h-full object-cover" />
                {item.annotations.length > 0 && (
                  <span className="absolute bottom-1 right-1 px-1 py-0.2 bg-red-600 text-white text-[9px] rounded font-medium">
                    已标注 ({item.annotations.length})
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImages(prev => prev.filter(img => img.id !== item.id));
                  }}
                  className="absolute top-1 right-1 p-0.5 bg-slate-900/70 hover:bg-red-600 text-white rounded-full transition-colors opacity-90 group-hover:opacity-100"
                  title="删除截图"
                >
                  <X size={12} />
                </button>
              </div>
            ))}

            {/* 添加截图操作 */}
            <div className="flex flex-col gap-1.5 justify-center">
              <button
                type="button"
                onClick={captureCurrentTab}
                disabled={isCapturing}
                className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition-colors"
                title="截取当前网页可视区域"
              >
                <Camera size={13} className={isCapturing ? 'animate-pulse text-blue-600' : ''} />
                <span>截取当前网页</span>
              </button>

              <label className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition-colors cursor-pointer">
                <FileUp size={13} />
                <span>上传本地图片</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* 5. 补充信息折叠面板 */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => setShowSupplementary(!showSupplementary)}
            className="w-full flex items-center justify-between p-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center space-x-1.5">
              <span>补充信息</span>
              {requiredListFields.length > 0 && !requiredFieldsFilled && (
                <span className="w-2 h-2 rounded-full bg-red-500" />
              )}
            </div>
            {showSupplementary ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>

          {showSupplementary && (
            <div className="p-3.5 pt-0 space-y-3.5 border-t border-slate-100 text-xs">
              {/* 云效动态必填字段 */}
              {requiredListFields.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-medium text-slate-700">云效必填字段</div>
                  {requiredListFields.map((field) => (
                    <ChipGroup
                      key={field.id}
                      title={field.name}
                      options={field.options.map(o => ({ id: o.id, displayName: o.displayValue || o.value }))}
                      value={customFieldValues[field.id]}
                      onChange={(val) => setCustomFieldValues(prev => ({ ...prev, [field.id]: val || '' }))}
                    />
                  ))}
                </div>
              )}

              {/* 严重程度 & 发生频率 */}
              <div className="space-y-2 pt-1">
                {!hasCloudSeverityField && (
                  <ChipGroup
                    title="严重程度"
                    options={SEVERITIES}
                    value={severity}
                    onChange={setSeverity}
                  />
                )}
                <ChipGroup
                  title="发生频率"
                  options={FREQUENCIES}
                  value={frequency}
                  onChange={setFrequency}
                />
              </div>

              {/* 环境与网络信息 */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEnvDisclosure(!showEnvDisclosure)}
                  className="flex items-center space-x-1 text-slate-500 hover:text-slate-800 text-[11px] font-medium"
                >
                  <Info size={12} />
                  <span>自动采集环境信息 ({snapshot?.recentRequests.length || 0} 条网络轨迹)</span>
                </button>

                {showEnvDisclosure && (
                  <div className="mt-2 p-2 bg-slate-50 rounded-lg text-[11px] text-slate-600 font-mono space-y-1 select-text">
                    <div>页面: {snapshot?.pageTitle || '-'}</div>
                    <div className="truncate">URL: {snapshot?.pageURL || '-'}</div>
                    <div>浏览器: {snapshot?.browserInfo || '-'}</div>
                    <div>网络: {snapshot?.networkStatus || '-'}</div>
                    {snapshot?.recentRequests && snapshot.recentRequests.length > 0 && (
                      <div className="pt-1 mt-1 border-t border-slate-200">
                        <div className="font-semibold text-slate-700">最近网络请求 (前 5 条):</div>
                        {snapshot.recentRequests.slice(0, 5).map((r, idx) => (
                          <div key={idx} className="truncate">
                            {r.method} {r.path.slice(0, 35)} · {r.statusCode || 'ERR'} · {r.durationMs}ms
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 提交结果反馈 */}
        {submitResult && (
          <div
            className={`p-3 rounded-xl border text-xs space-y-1 ${
              submitResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center space-x-1.5 font-semibold">
              {submitResult.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{submitResult.message}</span>
            </div>
            {submitResult.details && submitResult.details.failedAttachments.length > 0 && (
              <div className="text-[11px] text-red-600 pl-5">
                失败附件: {submitResult.details.failedAttachments.map(f => f.fileName).join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部固定提交操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-xs border-t border-slate-200 z-20">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !userDescription.trim() || !store.projectID.trim()}
          className="w-full flex items-center justify-center space-x-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
        >
          {isSubmitting ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>正在创建 Bug 工作项并上传附件…</span>
            </>
          ) : (
            <>
              <UploadCloud size={15} />
              <span>一键提交 Bug 到云效</span>
            </>
          )}
        </button>
      </div>

      {/* 图片标注模态弹窗 */}
      {activeAnnotateItem && (
        <ImageAnnotatorModal
          imageSrc={activeAnnotateItem.dataUrl}
          initialAnnotations={activeAnnotateItem.annotations}
          onDone={(newAnnotations) => {
            setImages(prev =>
              prev.map(item =>
                item.id === activeAnnotateItem.id ? { ...item, annotations: newAnnotations } : item,
              ),
            );
            setActiveAnnotateItem(null);
          }}
          onCancel={() => setActiveAnnotateItem(null)}
        />
      )}
    </div>
  );
};
