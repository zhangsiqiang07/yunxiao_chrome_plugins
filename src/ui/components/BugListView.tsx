import React, { useEffect, useState } from 'react';
import {
  ChevronDown, RefreshCw, Flag, User, Clock, AlertCircle, Edit2, Check, X,
  Search, RotateCcw,
} from 'lucide-react';
import { YunxiaoBugReporter } from '../../core/YunxiaoBugReporter';
import type {
  YXBProject, YXBWorkitem, YXBWorkflowStatus, YXBMember, YXBCurrentUser, YXBWorkitemFilter,
} from '../../models/YXBWorkitemModels';
import { useConfigStore } from '../store/useConfigStore';
import { BugDetailView } from './BugDetailView';

export const BugListView: React.FC = () => {
  const store = useConfigStore();

  const [workitems, setWorkitems] = useState<YXBWorkitem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<YXBWorkitem | null>(null);

  // 项目切换
  const [projectOptions, setProjectOptions] = useState<YXBProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [manualProjectInput, setManualProjectInput] = useState(store.projectID);

  // 筛选条件与选项
  const [selectedStatusId, setSelectedStatusId] = useState<string>('');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');
  const [statusOptions, setStatusOptions] = useState<YXBWorkflowStatus[]>([]);
  const [memberOptions, setMemberOptions] = useState<YXBMember[]>([]);
  const [currentUser, setCurrentUser] = useState<YXBCurrentUser | null>(null);

  const reporter = new YunxiaoBugReporter(store.buildConfigurationForProjectListing());

  // 1. 加载项目列表
  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const projects = await reporter.listOrganizationProjects();
      setProjectOptions(projects);
      if (!store.projectID && projects.length > 0) {
        store.setField('projectID', projects[0].id);
      }
    } catch {}
    finally {
      setLoadingProjects(false);
    }
  };

  // 2. 加载下拉筛选选项（状态列表、成员列表、当前用户信息）
  const loadFilterOptions = async (projId?: string) => {
    const targetProj = projId || store.projectID;
    if (!targetProj) return;
    try {
      const rep = new YunxiaoBugReporter(store.buildConfiguration({ projectID: targetProj }));
      const [membersResult, statusesResult, userResult] = await Promise.allSettled([
        rep.listProjectMembers(),
        rep.listWorkflowStatuses(store.workitemTypeID || undefined),
        rep.getCurrentUser(),
      ]);

      if (membersResult.status === 'fulfilled') setMemberOptions(membersResult.value);
      if (statusesResult.status === 'fulfilled') setStatusOptions(statusesResult.value);
      if (userResult.status === 'fulfilled') setCurrentUser(userResult.value);
    } catch {}
  };

  // 3. 加载 Bug 列表（带筛选）
  const loadWorkitems = async (
    targetPage = 1,
    append = false,
    overrideFilters?: { statusId?: string; assignedTo?: string; keyword?: string },
  ) => {
    if (!store.projectID) return;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    const stId = overrideFilters?.statusId !== undefined ? overrideFilters.statusId : selectedStatusId;
    const asId = overrideFilters?.assignedTo !== undefined ? overrideFilters.assignedTo : selectedAssignee;
    const kw = overrideFilters?.keyword !== undefined ? overrideFilters.keyword : keyword;

    // 解析实际负责人 ID
    let resolvedAssignee: string | undefined = undefined;
    if (asId === '__ME__') {
      resolvedAssignee = currentUser?.id || store.assignedTo || undefined;
    } else if (asId) {
      resolvedAssignee = asId;
    }

    // 解析实际状态名
    const matchingStatus = statusOptions.find(s => s.id === stId || s.name === stId);
    const resolvedStatusName = matchingStatus?.name || matchingStatus?.displayName || (stId ? stId : undefined);

    const filterPayload: YXBWorkitemFilter = {
      statusId: stId || undefined,
      statusName: resolvedStatusName,
      assignedTo: resolvedAssignee,
      keyword: kw.trim() || undefined,
    };

    try {
      const rep = new YunxiaoBugReporter(store.buildConfiguration());
      const items = await rep.listWorkitems(targetPage, 20, 'Bug', filterPayload);
      if (append) {
        setWorkitems(prev => [...prev, ...items]);
        setPage(targetPage);
      } else {
        setWorkitems(items);
        setPage(1);
      }
      setHasMore(items.length >= 20);
    } catch (err: any) {
      setError(err.message || '加载 Bug 列表失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedStatusId('');
    setSelectedAssignee('');
    setKeyword('');
    loadWorkitems(1, false, { statusId: '', assignedTo: '', keyword: '' });
  };

  useEffect(() => {
    loadProjects();
    loadFilterOptions();
    loadWorkitems(1, false);
  }, []);

  useEffect(() => {
    if (store.projectID) {
      loadFilterOptions(store.projectID);
      loadWorkitems(1, false);
    }
  }, [store.projectID]);

  const formatDate = (ms?: number) => {
    if (!ms) return '';
    const d = new Date(ms);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleApplyManualProject = () => {
    const val = manualProjectInput.trim();
    store.setField('projectID', val);
    store.save();
    setIsEditingProject(false);
  };

  const getStatusBadgeClass = (name?: string) => {
    if (!name) return 'text-slate-500 bg-slate-100 border-slate-200';
    const n = name.toLowerCase();
    if (n.includes('解决') || n.includes('完成') || n.includes('resolve') || n.includes('done') || n.includes('fix')) {
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    }
    if (n.includes('处理中') || n.includes('进行中') || n.includes('progress') || n.includes('doing')) {
      return 'text-blue-700 bg-blue-50 border-blue-200';
    }
    if (n.includes('关闭') || n.includes('close')) {
      return 'text-purple-700 bg-purple-50 border-purple-200';
    }
    if (n.includes('拒绝') || n.includes('reject') || n.includes('reopen')) {
      return 'text-rose-700 bg-rose-50 border-rose-200';
    }
    return 'text-amber-700 bg-amber-50 border-amber-200';
  };

  const hasActiveFilters = Boolean(selectedStatusId || selectedAssignee || keyword.trim());

  if (selectedItem) {
    return (
      <BugDetailView
        item={selectedItem}
        onBack={() => setSelectedItem(null)}
        onStatusChange={(workitemId, newStatus) => {
          setWorkitems(prev => prev.map(w => w.id === workitemId ? { ...w, statusName: newStatus } : w));
          setSelectedItem(prev => prev && prev.id === workitemId ? { ...prev, statusName: newStatus } : prev);
        }}
      />
    );
  }

  const currentProjectName = projectOptions.find(p => p.id === store.projectID)?.name || store.projectID || '选择项目';

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* 顶部栏：切换项目与刷新 */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200">
        {isEditingProject ? (
          <div className="flex items-center space-x-1 flex-1 mr-2">
            <input
              type="text"
              placeholder="输入项目 ID"
              value={manualProjectInput}
              onChange={(e) => setManualProjectInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyManualProject();
                if (e.key === 'Escape') setIsEditingProject(false);
              }}
              autoFocus
              className="flex-1 text-xs px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleApplyManualProject}
              className="p-1 text-emerald-600 hover:text-emerald-700"
              title="确定"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => setIsEditingProject(false)}
              className="p-1 text-slate-400 hover:text-slate-600"
              title="取消"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 flex-1 min-w-0 mr-2">
            <select
              value={store.projectID}
              onChange={(e) => {
                const val = e.target.value;
                store.setField('projectID', val);
                store.save();
              }}
              className="text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none truncate cursor-pointer pr-4"
            >
              <option value="">选择项目</option>
              {store.projectID && !projectOptions.some(p => p.id === store.projectID) && (
                <option value={store.projectID}>
                  {store.projectID} (指定项目)
                </option>
              )}
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.id}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="text-slate-400 shrink-0 -ml-3 pointer-events-none" />
            <button
              type="button"
              onClick={() => {
                setManualProjectInput(store.projectID);
                setIsEditingProject(true);
              }}
              className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
              title="手动输入项目 ID"
            >
              <Edit2 size={12} />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            loadProjects();
            loadFilterOptions();
            loadWorkitems(1, false);
          }}
          disabled={loading || !store.projectID}
          className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-40 rounded-lg hover:bg-slate-100 transition-colors"
          title="刷新列表"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 搜索与筛选工具栏 */}
      <div className="px-3 py-2 bg-white border-b border-slate-200/80 space-y-1.5 shadow-2xs shrink-0">
        {/* 搜索输入框 */}
        <div className="relative flex items-center">
          <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="搜索 Bug 标题 / 编号..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                loadWorkitems(1, false, { keyword: e.currentTarget.value });
              }
            }}
            className="w-full text-xs pl-7 pr-7 py-1.5 bg-slate-100 hover:bg-slate-100/80 focus:bg-white border border-transparent focus:border-blue-400 rounded-lg transition-all focus:outline-none placeholder:text-slate-400"
          />
          {keyword && (
            <button
              type="button"
              onClick={() => {
                setKeyword('');
                loadWorkitems(1, false, { keyword: '' });
              }}
              className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
              title="清空搜索"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* 筛选选择器：状态与负责人 */}
        <div className="flex items-center space-x-1.5 text-xs">
          {/* 状态筛选 */}
          <div className="relative flex-1">
            <select
              value={selectedStatusId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedStatusId(val);
                loadWorkitems(1, false, { statusId: val });
              }}
              className={`w-full text-[11px] py-1 pl-2 pr-5 rounded-md border appearance-none truncate cursor-pointer transition-colors ${
                selectedStatusId
                  ? 'bg-blue-50 text-blue-700 border-blue-200 font-medium'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              <option value="">全部状态</option>
              {statusOptions.map((st) => (
                <option key={st.id || st.name} value={st.id || st.name}>
                  {st.displayName || st.name}
                </option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-2 text-slate-400 pointer-events-none" />
          </div>

          {/* 负责人筛选 */}
          <div className="relative flex-1">
            <select
              value={selectedAssignee}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedAssignee(val);
                loadWorkitems(1, false, { assignedTo: val });
              }}
              className={`w-full text-[11px] py-1 pl-2 pr-5 rounded-md border appearance-none truncate cursor-pointer transition-colors ${
                selectedAssignee
                  ? 'bg-blue-50 text-blue-700 border-blue-200 font-medium'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              <option value="">全部负责人</option>
              <option value="__ME__">指派给我 {currentUser?.name ? `(${currentUser.name})` : ''}</option>
              {memberOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-2 text-slate-400 pointer-events-none" />
          </div>

          {/* 重置筛选按钮 */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="p-1 px-1.5 text-[11px] text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors shrink-0 flex items-center space-x-0.5"
              title="重置所有筛选"
            >
              <RotateCcw size={10} />
              <span>重置</span>
            </button>
          )}
        </div>
      </div>

      {/* 列表内容 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-12">
        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center space-x-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {workitems.length === 0 && !loading && !error && (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400 text-xs space-y-2">
            <Flag size={28} className="text-slate-300 stroke-1" />
            <span>
              {!store.projectID
                ? '请先选择项目'
                : hasActiveFilters
                ? '未找到符合筛选条件的 Bug'
                : '暂无 Bug 工作项'}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-1 px-2.5 py-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md font-medium transition-colors"
              >
                清空筛选条件
              </button>
            )}
          </div>
        )}

        {workitems.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedItem(item)}
            className="bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-xs cursor-pointer transition-all space-y-1.5"
          >
            <div className="text-xs font-medium text-slate-800 line-clamp-2 leading-snug">
              {item.subject || '(无标题)'}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
              <div className="flex items-center space-x-2">
                {item.statusName && (
                  <span className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${getStatusBadgeClass(item.statusName)}`}>
                    <Flag size={10} />
                    <span>{item.statusName}</span>
                  </span>
                )}
                {item.assignedToName && (
                  <span className="flex items-center space-x-1 text-slate-500">
                    <User size={11} />
                    <span>{item.assignedToName}</span>
                  </span>
                )}
              </div>
              {item.gmtCreate && (
                <span className="flex items-center space-x-1 font-mono">
                  <Clock size={10} />
                  <span>{formatDate(item.gmtCreate)}</span>
                </span>
              )}
            </div>
          </div>
        ))}

        {hasMore && workitems.length > 0 && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => loadWorkitems(page + 1, true)}
              disabled={loadingMore}
              className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg font-medium transition-colors"
            >
              {loadingMore ? '正在加载…' : '加载更多'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
