import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, RotateCcw, Square, Trash2, X, Check } from 'lucide-react';

export interface Point {
  x: number;
  y: number;
}

export interface ImageAnnotation {
  id: string;
  kind: 'rect' | 'arrow';
  start: Point; // 归一化坐标 0..1
  end: Point;   // 归一化坐标 0..1
}

interface ImageAnnotatorModalProps {
  imageSrc: string;
  initialAnnotations?: ImageAnnotation[];
  onDone: (annotations: ImageAnnotation[]) => void;
  onCancel: () => void;
}

export const ImageAnnotatorModal: React.FC<ImageAnnotatorModalProps> = ({
  imageSrc,
  initialAnnotations = [],
  onDone,
  onCancel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [tool, setTool] = useState<'rect' | 'arrow'>('rect');
  const [annotations, setAnnotations] = useState<ImageAnnotation[]>(initialAnnotations);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  const [drawingStart, setDrawingStart] = useState<Point | null>(null);
  const [drawingCurrent, setDrawingCurrent] = useState<Point | null>(null);

  // 加载图片
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => setImageObj(img);
  }, [imageSrc]);

  // 计算图片在容器内的绘制区域 (scaledToFit)
  const getContentRect = () => {
    if (!containerRef.current || !imageObj) return { x: 0, y: 0, width: 0, height: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const cWidth = rect.width;
    const cHeight = rect.height;
    const scale = Math.min(cWidth / imageObj.naturalWidth, cHeight / imageObj.naturalHeight);
    const w = imageObj.naturalWidth * scale;
    const h = imageObj.naturalHeight * scale;
    return {
      x: (cWidth - w) / 2,
      y: (cHeight - h) / 2,
      width: w,
      height: h,
    };
  };

  // 重绘画布
  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current || !imageObj) return;

    const rect = containerRef.current.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const cRect = getContentRect();
    if (cRect.width <= 0) return;

    // 绘制图片
    ctx.drawImage(imageObj, cRect.x, cRect.y, cRect.width, cRect.height);

    // 绘制已确认标注
    ctx.strokeStyle = '#ef4444'; // 红色
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawSingleAnnotation = (ann: { kind: 'rect' | 'arrow'; start: Point; end: Point }) => {
      const sx = cRect.x + ann.start.x * cRect.width;
      const sy = cRect.y + ann.start.y * cRect.height;
      const ex = cRect.x + ann.end.x * cRect.width;
      const ey = cRect.y + ann.end.y * cRect.height;

      if (ann.kind === 'rect') {
        const rx = Math.min(sx, ex);
        const ry = Math.min(sy, ey);
        const rw = Math.abs(ex - sx);
        const rh = Math.abs(ey - sy);
        ctx.strokeRect(rx, ry, rw, rh);
      } else {
        drawArrow(ctx, sx, sy, ex, ey, 14);
      }
    };

    annotations.forEach(drawSingleAnnotation);

    // 绘制正在绘制中的标注
    if (drawingStart && drawingCurrent) {
      drawSingleAnnotation({ kind: tool, start: drawingStart, end: drawingCurrent });
    }
  };

  useEffect(() => {
    redraw();
  }, [imageObj, annotations, drawingStart, drawingCurrent]);

  // 窗口 resize 监听
  useEffect(() => {
    window.addEventListener('resize', redraw);
    return () => window.removeEventListener('resize', redraw);
  }, [imageObj, annotations]);

  // 坐标转换：屏幕坐标 → 归一化 (0..1)
  const getNormalizedPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point | null => {
    const cRect = getContentRect();
    if (cRect.width <= 0 || !canvasRef.current) return null;
    const canvasBox = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - canvasBox.left;
    const mouseY = e.clientY - canvasBox.top;

    const normX = Math.max(0, Math.min(1, (mouseX - cRect.x) / cRect.width));
    const normY = Math.max(0, Math.min(1, (mouseY - cRect.y) / cRect.height));
    return { x: normX, y: normY };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = getNormalizedPoint(e);
    if (!p) return;
    setDrawingStart(p);
    setDrawingCurrent(p);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingStart) return;
    const p = getNormalizedPoint(e);
    if (p) setDrawingCurrent(p);
  };

  const handleMouseUp = () => {
    if (!drawingStart || !drawingCurrent) {
      setDrawingStart(null);
      setDrawingCurrent(null);
      return;
    }

    const dx = Math.abs(drawingCurrent.x - drawingStart.x);
    const dy = Math.abs(drawingCurrent.y - drawingStart.y);

    // 过滤误触
    if (dx > 0.01 || dy > 0.01) {
      setAnnotations(prev => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          kind: tool,
          start: drawingStart,
          end: drawingCurrent,
        },
      ]);
    }

    setDrawingStart(null);
    setDrawingCurrent(null);
  };

  const handleUndo = () => {
    setAnnotations(prev => prev.slice(0, prev.length - 1));
  };

  const handleClear = () => {
    setAnnotations([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/90 backdrop-blur-sm select-none">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 text-white shadow-md">
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
          title="取消"
        >
          <X size={18} />
        </button>

        {/* 工具选择 */}
        <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-700">
          <button
            type="button"
            onClick={() => setTool('rect')}
            className={`flex items-center space-x-1 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              tool === 'rect' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Square size={13} />
            <span>框选</span>
          </button>
          <button
            type="button"
            onClick={() => setTool('arrow')}
            className={`flex items-center space-x-1 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              tool === 'arrow' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowUpRight size={14} />
            <span>箭头</span>
          </button>
        </div>

        {/* 撤销 / 清除 / 完成 */}
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={annotations.length === 0}
            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 rounded-lg hover:bg-slate-700 transition-colors"
            title="撤销"
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={annotations.length === 0}
            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 rounded-lg hover:bg-slate-700 transition-colors"
            title="清空"
          >
            <Trash2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => onDone(annotations)}
            className="flex items-center space-x-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Check size={14} />
            <span>完成</span>
          </button>
        </div>
      </div>

      {/* 画布区域 */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden flex items-center justify-center p-2 cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="max-w-full max-h-full"
        />
      </div>
    </div>
  );
};

// 绘制箭头辅助函数（对标 iOS yxb_arrowPath）
function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  headLen = 14,
) {
  const angle = Math.atan2(toY - fromY, toX - fromX);

  // 箭身
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // 箭头两侧翼
  const a1 = angle + Math.PI / 7;
  const a2 = angle - Math.PI / 7;

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLen * Math.cos(a1), toY - headLen * Math.sin(a1));
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLen * Math.cos(a2), toY - headLen * Math.sin(a2));
  ctx.stroke();
}

/**
 * 将标注按原图原始自然分辨率烘焙进图片，并导出为 JPEG Blob（对标 iOS yxb_bakeAnnotations）
 */
export async function bakeAnnotations(imageSrc: string, annotations: ImageAnnotation[]): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      if (annotations.length === 0) {
        // 无标注，直接从 canvas 导出原始 JPEG
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable'));
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Export blob failed')), 'image/jpeg', 0.85);
        return;
      }

      const canvas = document.createElement('canvas');
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context unavailable'));

      // 绘制原图
      ctx.drawImage(img, 0, 0);

      // 自适应线宽
      const lineWidth = Math.max(w * 0.012, 4);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const ann of annotations) {
        const sx = ann.start.x * w;
        const sy = ann.start.y * h;
        const ex = ann.end.x * w;
        const ey = ann.end.y * h;

        if (ann.kind === 'rect') {
          const rx = Math.min(sx, ex);
          const ry = Math.min(sy, ey);
          const rw = Math.abs(ex - sx);
          const rh = Math.abs(ey - sy);
          ctx.strokeRect(rx, ry, rw, rh);
        } else {
          drawArrow(ctx, sx, sy, ex, ey, Math.max(lineWidth * 3.5, 16));
        }
      }

      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('Bake blob failed'))),
        'image/jpeg',
        0.85,
      );
    };
    img.onerror = reject;
  });
}
