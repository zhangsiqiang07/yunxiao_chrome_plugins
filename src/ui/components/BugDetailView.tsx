import React, { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Calendar, User, Tag, Flag, AlertCircle, RefreshCw, ChevronDown, Check } from 'lucide-react';
import { YunxiaoBugReporter } from '../../core/YunxiaoBugReporter';
import { parseDescription } from '../../core/YXBDescriptionParser';
import type { YXBWorkitem, YXBWorkflowStatus } from '../../models/YXBWorkitemModels';
import { useConfigStore } from '../store/useConfigStore';
import { AuthImageView } from './AuthImageView';

interface BugDetailViewProps {
  item: YXBWorkitem;
  onBack: () => void;
  onStatusChange?: (workitemId: string, newStatus: string) => void;
}

export const BugDetailView: React.FC<BugDetailViewProps> = ({ item, onBack, onStatusChange }) => {
  const store = useConfigStore();
  const [detail, setDetail] = useState<YXBWorkitem>(item || { id: '', subject: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // 状态修改相关
  const [workflowStatuses, setWorkflowStatuses] = useState<YXBWorkflowStatus[]>([]);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const reporter = new YunxiaoBugReporter(store.buildConfigurationForProjectListing());

  useEffect(() => {
    let active = true;
    if (!item?.id) return;

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetched = await reporter.getWorkitem(item.id);
        if (active && fetched) setDetail(fetched);
      } catch (err: any) {
        if (active) setError(err.message || '加载详情失败');
      } finally {
        if (active) setLoading(false);
      }
    };

    const fetchStatuses = async () => {
      try {
        const statuses = await reporter.listWorkflowStatuses(undefined, item.id);
        if (active && statuses.length > 0) {
          setWorkflowStatuses(statuses);
        }
      } catch {
        // 使用默认状态，不影响详情渲染
      }
    };

    fetchDetail();
    fetchStatuses();
    return () => { active = false; };
  }, [item?.id]);

  const handleUpdateStatus = async (targetStatus: YXBWorkflowStatus) => {
    if (!detail.id) return;
    setStatusMenuOpen(false);
    setUpdatingStatus(true);
    setError(null);

    const targetName = targetStatus.displayName || targetStatus.name;
    try {
      await reporter.updateWorkitemStatus(detail.id, targetStatus.id, targetStatus.name);
      setDetail(prev => ({ ...prev, statusName: targetName }));
      setSuccessToast(`状态已更新为：${targetName}`);
      setTimeout(() => setSuccessToast(null), 3000);
      onStatusChange?.(detail.id, targetName);
    } catch (err: any) {
      setError(err.message || '修改状态失败');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openInYunxiao = () => {
    // 构造云效工作项链接
    const proj = store.projectID || detail.spaceName || '';
    const wid = detail.id || item?.id || '';
    const url = `https://devops.aliyun.com/projex/project/${proj}/workitem/${wid}`;
    chrome.tabs.create({ url });
  };

  const formatDate = (ms?: number) => {
    if (!ms) return '-';
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const getStatusDotColor = (name?: string) => {
    if (!name) return 'bg-slate-400';
    const n = name.toLowerCase();
    if (n.includes('解决') || n.includes('完成') || n.includes('resolve') || n.includes('done') || n.includes('fix')) {
      return 'bg-emerald-500';
    }
    if (n.includes('处理中') || n.includes('进行中') || n.includes('progress') || n.includes('doing')) {
      return 'bg-blue-500';
    }
    if (n.includes('关闭') || n.includes('close')) {
      return 'bg-purple-500';
    }
    if (n.includes('拒绝') || n.includes('reject') || n.includes('reopen')) {
      return 'bg-rose-500';
    }
    return 'bg-amber-500';
  };

  const getStatusColor = (name?: string) => {
    if (!name) return 'bg-slate-100 text-slate-700 border-slate-200';
    const n = name.toLowerCase();
    if (n.includes('解决') || n.includes('完成') || n.includes('resolve') || n.includes('done') || n.includes('fix')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (n.includes('处理中') || n.includes('进行中') || n.includes('progress') || n.includes('doing')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (n.includes('关闭') || n.includes('close')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (n.includes('拒绝') || n.includes('reject') || n.includes('reopen')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  const parsedDesc = parseDescription(detail?.description);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto pb-10">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2.5 bg-white border-b border-slate-200">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center space-x-1 p-1 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 text-xs font-medium"
        >
          <ArrowLeft size={16} />
          <span>返回列表</span>
        </button>

        <button
          type="button"
          onClick={openInYunxiao}
          className="flex items-center space-x-1 px-2.5 py-1 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium transition-colors"
        >
          <span>在云效打开</span>
          <ExternalLink size={12} />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* 标题卡片 */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2 shadow-sm">
          <div className="flex items-start justify-between space-x-2">
            <h1 className="text-sm font-semibold text-slate-900 leading-snug">
              {detail.subject || '(无标题)'}
            </h1>
            {loading && <RefreshCw size={13} className="animate-spin text-slate-400 shrink-0 mt-0.5" />}
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-400 font-mono">
            <span>ID: {detail.id}</span>
            {detail.serialNumber && <span>· 编号: #{detail.serialNumber}</span>}
          </div>
        </div>

        {error && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center space-x-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {successToast && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center space-x-2 animate-fadeIn">
            <Check size={15} className="text-emerald-600" />
            <span>{successToast}</span>
          </div>
        )}

        {/* 基本信息 */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5 shadow-sm text-xs">
          <div className="text-xs font-semibold text-slate-800">基本信息</div>
          <div className="grid grid-cols-2 gap-2 text-slate-600">
            {/* 状态（支持交互式修改） */}
            <div className="relative">
              <div className="flex items-center space-x-1.5">
                <Flag size={13} className="text-slate-400 shrink-0" />
                <span className="text-slate-400 shrink-0">状态:</span>
                <button
                  type="button"
                  disabled={updatingStatus}
                  onClick={() => setStatusMenuOpen(prev => !prev)}
                  className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-medium border transition-all ${getStatusColor(detail.statusName)} ${
                    updatingStatus ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-xs cursor-pointer'
                  }`}
                  title="点击修改状态"
                >
                  {updatingStatus ? (
                    <RefreshCw size={11} className="animate-spin" />
                  ) : (
                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(detail.statusName)}`} />
                  )}
                  <span>{detail.statusName || '未设置'}</span>
                  <ChevronDown size={11} className="opacity-60" />
                </button>
              </div>

              {/* 状态弹出列表 */}
              {statusMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setStatusMenuOpen(false)}
                  />
                  <div className="absolute left-10 top-7 z-30 w-36 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-xs">
                    <div className="px-2.5 py-1 text-[10px] text-slate-400 font-medium border-b border-slate-100 mb-0.5">
                      修改工作项状态
                    </div>
                    {workflowStatuses.map((st) => {
                      const isCurrent = detail.statusName === st.name || detail.statusName === st.displayName;
                      return (
                        <button
                          key={st.id || st.name}
                          type="button"
                          onClick={() => handleUpdateStatus(st)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-50 transition-colors text-left ${
                            isCurrent ? 'font-semibold text-blue-600 bg-blue-50/50' : 'text-slate-700'
                          }`}
                        >
                          <div className="flex items-center space-x-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(st.name || st.displayName)}`} />
                            <span>{st.displayName || st.name}</span>
                          </div>
                          {isCurrent && <Check size={12} className="text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {detail.assignedToName && (
              <div className="flex items-center space-x-1.5">
                <User size={13} className="text-slate-400" />
                <span className="text-slate-400">负责人:</span>
                <span className="font-medium text-slate-700 truncate">{detail.assignedToName}</span>
              </div>
            )}
            {detail.priorityName && (
              <div className="flex items-center space-x-1.5">
                <Tag size={13} className="text-slate-400" />
                <span className="text-slate-400">优先级:</span>
                <span className="font-medium text-slate-700">{detail.priorityName}</span>
              </div>
            )}
            {detail.severityName && (
              <div className="flex items-center space-x-1.5">
                <Tag size={13} className="text-slate-400" />
                <span className="text-slate-400">严重程度:</span>
                <span className="font-medium text-slate-700">{detail.severityName}</span>
              </div>
            )}
            {detail.creatorName && (
              <div className="flex items-center space-x-1.5">
                <User size={13} className="text-slate-400" />
                <span className="text-slate-400">创建人:</span>
                <span className="font-medium text-slate-700 truncate">{detail.creatorName}</span>
              </div>
            )}
            {detail.gmtCreate && (
              <div className="col-span-2 flex items-center space-x-1.5">
                <Calendar size={13} className="text-slate-400" />
                <span className="text-slate-400">创建时间:</span>
                <span className="text-slate-600 font-mono text-[11px]">{formatDate(detail.gmtCreate)}</span>
              </div>
            )}
          </div>
        </div>

        {/* 描述与内嵌图片 */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3 shadow-sm">
          <div className="text-xs font-semibold text-slate-800">问题描述</div>
          {parsedDesc.text ? (
            <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed select-text font-sans">
              {parsedDesc.text}
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">暂无文本描述</div>
          )}

          {parsedDesc.imageURLs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="text-[11px] font-medium text-slate-400">附带图片 ({parsedDesc.imageURLs.length})</div>
              {parsedDesc.imageURLs.map((imgUrl, idx) => (
                <AuthImageView
                  key={idx}
                  url={imgUrl}
                  workitemID={detail.id}
                  reporter={reporter}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
