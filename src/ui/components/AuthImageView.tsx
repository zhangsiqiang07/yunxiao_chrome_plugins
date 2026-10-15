import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, AlertTriangle, RefreshCw } from 'lucide-react';
import type { YunxiaoBugReporter } from '../../core/YunxiaoBugReporter';

interface AuthImageViewProps {
  url: string;
  workitemID: string;
  reporter: YunxiaoBugReporter;
  className?: string;
}

export const AuthImageView: React.FC<AuthImageViewProps> = ({
  url,
  workitemID,
  reporter,
  className = '',
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isConsoleProxyUrl = (rawUrl: string): string | null => {
    try {
      const u = new URL(rawUrl);
      if (u.hostname.includes('devops.aliyun.com') && u.pathname.includes('/projex/api/workitem/file/url')) {
        return u.searchParams.get('fileIdentifier');
      }
    } catch {}
    return null;
  };

  const loadImage = async () => {
    setLoading(true);
    setError(false);
    try {
      const fid = isConsoleProxyUrl(url);
      let buffer: ArrayBuffer;
      if (fid && workitemID) {
        buffer = await reporter.downloadWorkitemFile(fid, workitemID);
      } else {
        buffer = await reporter.downloadImage(url);
      }
      const blob = new Blob([buffer]);
      const objUrl = URL.createObjectURL(blob);
      setObjectUrl(objUrl);
    } catch (err) {
      console.warn('[AuthImageView] 加载图片失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImage();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, workitemID]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 rounded-lg p-6 border border-slate-200 text-slate-400 text-xs ${className}`}>
        <RefreshCw size={14} className="animate-spin mr-2" />
        <span>正在加载鉴权图片…</span>
      </div>
    );
  }

  if (error || !objectUrl) {
    return (
      <div
        onClick={loadImage}
        className={`flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 cursor-pointer rounded-lg p-6 border border-dashed border-slate-300 text-slate-500 text-xs transition-colors ${className}`}
        title="点击重新加载"
      >
        <AlertTriangle size={15} className="text-amber-500" />
        <span>图片加载失败，点击重试</span>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-lg border border-slate-200 bg-white ${className}`}>
      <img
        src={objectUrl}
        alt="工作项附件"
        className="max-w-full h-auto object-contain mx-auto"
      />
    </div>
  );
};
