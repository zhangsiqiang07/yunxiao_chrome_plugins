import React, { useState } from 'react';
import { Check, AlertCircle, Save, Sparkles, Shield, Database } from 'lucide-react';
import { useConfigStore } from '../store/useConfigStore';

interface ConfigViewProps {
  mode?: 'normal' | 'forced';
  onSaved?: () => void;
}

export const ConfigView: React.FC<ConfigViewProps> = ({ mode = 'normal', onSaved }) => {
  const store = useConfigStore();
  const [toastMessage, setToastMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const showToast = (text: string, error = false) => {
    setToastMessage({ text, error });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSave = async () => {
    const errors = store.validationErrors();
    if (errors.length > 0) {
      showToast(errors[0], true);
      return;
    }
    await store.save();
    showToast('配置保存成功！');
    if (onSaved) onSaved();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto pb-10">
      {/* 顶部标题栏 */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            {mode === 'forced' ? '初始化云效配置' : '云效服务配置'}
          </h2>
          <p className="text-xs text-slate-500">配置云效组织与访问凭证</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
        >
          <Save size={14} />
          <span>保存配置</span>
        </button>
      </div>

      {/* 提示消息 */}
      {toastMessage && (
        <div
          className={`mx-3 mt-3 p-2.5 rounded-lg text-xs flex items-center space-x-2 ${
            toastMessage.error
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          {toastMessage.error ? <AlertCircle size={15} /> : <Check size={15} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      <div className="p-3 space-y-4">
        {/* 1. 云效服务 */}
        <section className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3.5">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-800">
            <Database size={14} className="text-blue-600" />
            <span>云效服务空间</span>
          </div>

          {/* 服务域名 */}
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">服务域名</span>
            <span className="text-slate-700 font-mono text-[11px] select-text">{store.domain}</span>
          </div>

          {/* 版本选择 */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">空间版本</span>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => store.setField('edition', 'standard')}
                className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-all ${
                  store.edition === 'standard' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                }`}
              >
                中心版
              </button>
              <button
                type="button"
                onClick={() => store.setField('edition', 'region')}
                className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-all ${
                  store.edition === 'region' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                }`}
              >
                Region 版
              </button>
            </div>
          </div>

          {/* 组织 ID（中心版必填，可填写） */}
          {store.edition === 'standard' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-slate-700">组织 ID</label>
                <span className="text-[11px] text-amber-600 font-medium">* 必填</span>
              </div>
              <input
                type="text"
                placeholder="请输入云效组织 ID（如 684a7e1780f513ec112a77e0）"
                value={store.organizationID}
                onChange={(e) => store.setField('organizationID', e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
              <p className="text-[11px] text-slate-400">
                中心版 OpenAPI 调用依赖组织 ID，可在云效企业设置中获取。
              </p>
            </div>
          )}

          {/* 默认负责人（可选） */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <label className="text-xs font-medium text-slate-700">默认负责人用户 ID（可选）</label>
            <input
              type="text"
              placeholder="默认指派的云效用户 ID（留空可在提单页实时选择）"
              value={store.assignedTo}
              onChange={(e) => store.setField('assignedTo', e.target.value)}
              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>

          {/* 提示信息 */}
          <div className="p-2.5 bg-blue-50/50 rounded-lg border border-blue-100 text-[11px] text-blue-700 leading-relaxed">
            💡 项目无需在配置中指定，在「提交 Bug」或「Bug 列表」页面可直接选择并自由切换所属项目。
          </div>
        </section>

        {/* 2. 访问凭证 */}
        <section className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-800">
            <Shield size={14} className="text-emerald-600" />
            <span>访问凭证 (PAT Token)</span>
          </div>
          <div className="space-y-1">
            <input
              type="password"
              placeholder="云效个人访问令牌"
              value={store.token}
              onChange={(e) => store.setField('token', e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
            <p className="text-[11px] text-slate-400">
              请确保 Token 具备「项目只读」、「项目协作 工作项 读写」等权限。
            </p>
          </div>
        </section>

        {/* 3. AI 辅助配置 */}
        <section className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-800">
            <Sparkles size={14} className="text-purple-600" />
            <span>Bug AI 服务（可选）</span>
          </div>
          <div className="space-y-1">
            <input
              type="text"
              placeholder="https://bug-ai.example.com"
              value={store.aiServiceDomain}
              onChange={(e) => store.setField('aiServiceDomain', e.target.value)}
              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-400">
              配置 AI 域名后可在提单页使用「AI 优化描述」一键生成复现步骤与标题。
            </p>
          </div>
        </section>

        {/* 4. 结果缓存 */}
        <section className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">结果缓存</span>
            <input
              type="checkbox"
              checked={store.cacheEnabled}
              onChange={(e) => store.setField('cacheEnabled', e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
          </div>
          {store.cacheEnabled && (
            <div className="space-y-2.5 pt-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">缓存后端</span>
                <select
                  value={store.cacheBackend}
                  onChange={(e) => store.setField('cacheBackend', e.target.value as any)}
                  className="text-xs p-1 bg-slate-50 border border-slate-200 rounded"
                >
                  <option value="chromeStorage">Local Storage (持久化)</option>
                  <option value="memory">Session Memory (内存)</option>
                </select>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">工作项类型 TTL</span>
                <span className="text-slate-700 font-mono">{store.workitemTypeCacheTTL}s (1h)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Token 缓存 TTL</span>
                <span className="text-slate-700 font-mono">{store.tokenCacheTTL}s (5m)</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
