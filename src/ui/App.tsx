import React, { useEffect, useState } from 'react';
import { Bug, List, Settings } from 'lucide-react';
import { BugListView } from './components/BugListView';
import { ConfigView } from './components/ConfigView';
import { SubmitView } from './components/SubmitView';
import { useConfigStore } from './store/useConfigStore';

type TabType = 'submit' | 'list' | 'config';

export const App: React.FC = () => {
  const store = useConfigStore();
  const [activeTab, setActiveTab] = useState<TabType>('submit');

  useEffect(() => {
    store.load();
  }, []);

  if (!store.loaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-400 text-xs">
        正在加载插件配置…
      </div>
    );
  }

  // 尚未配置项目时，强制展示配置页面引导用户配置
  if (!store.isConfigured()) {
    return (
      <div className="flex flex-col h-screen">
        <ConfigView mode="forced" onSaved={() => setActiveTab('submit')} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* 视图内容区 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'submit' && <SubmitView />}
        {activeTab === 'list' && <BugListView />}
        {activeTab === 'config' && <ConfigView mode="normal" />}
      </div>

      {/* 底部 TabBar */}
      <nav className="flex items-center justify-around h-12 bg-white border-t border-slate-200 shrink-0 z-30">
        <button
          type="button"
          onClick={() => setActiveTab('submit')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
            activeTab === 'submit' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Bug size={18} className="mb-0.5" />
          <span className="text-[10px]">提交 Bug</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
            activeTab === 'list' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <List size={18} className="mb-0.5" />
          <span className="text-[10px]">Bug 列表</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('config')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
            activeTab === 'config' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Settings size={18} className="mb-0.5" />
          <span className="text-[10px]">云效设置</span>
        </button>
      </nav>
    </div>
  );
};
