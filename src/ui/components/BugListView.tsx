import React, { useEffect, useState } from 'react';
import { ChevronDown, RefreshCw, Flag, User, Clock, AlertCircle } from 'lucide-react';
import { YunxiaoBugReporter } from '../../core/YunxiaoBugReporter';
import type { YXBProject, YXBWorkitem } from '../../models/YXBWorkitemModels';
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

  // 2. 加载 Bug 列表
  const loadWorkitems = async (targetPage = 1, append = false) => {
    if (!store.projectID) return;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    try {
      const rep = new YunxiaoBugReporter(store.buildConfiguration());
      const items = await rep.listWorkitems(targetPage, 20, 'Bug');
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

  useEffect(() => {
    loadProjects();
    loadWorkitems(1, false);
  }, []);

  useEffect(() => {
    if (store.projectID) {
      loadWorkitems(1, false);
    }
  }, [store.projectID]);

  const formatDate = (ms?: number) => {
    if (!ms) return '';
    const d = new Date(ms);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (selectedItem) {
    return <BugDetailView item={selectedItem} onBack={() => setSelectedItem(null)} />;
  }

  const currentProjectName = projectOptions.find(p => p.id === store.projectID)?.name || store.projectID || '选择项目';

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* 顶部栏：切换项目与刷新 */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center space-x-1.5 flex-1 min-w-0 mr-2">
          <select
            value={store.projectID}
            onChange={(e) => store.setField('projectID', e.target.value)}
            className="text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none truncate cursor-pointer pr-4"
          >
            <option value="">选择项目</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.id}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="text-slate-400 shrink-0 -ml-3 pointer-events-none" />
        </div>

        <button
          type="button"
          onClick={() => loadWorkitems(1, false)}
          disabled={loading || !store.projectID}
          className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-40 rounded-lg hover:bg-slate-100 transition-colors"
          title="刷新列表"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
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
            <span>{!store.projectID ? '请先选择项目' : '暂无 Bug 工作项'}</span>
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
                  <span className="flex items-center space-x-1 text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
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
