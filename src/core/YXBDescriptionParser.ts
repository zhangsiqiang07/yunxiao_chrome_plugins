/**
 * 描述解析器（对标 YXBDescriptionParser.swift）
 * 支持 JSON 结构化 (jsonMLValue/htmlValue)、HTML、Markdown
 */
export interface ParsedDescription { text: string; imageURLs: string[]; }

export function parseDescription(description?: string | null): ParsedDescription {
  if (!description) return { text: '', imageURLs: [] };

  // 1) JSON 结构化
  try {
    const json = JSON.parse(description);
    if (json && typeof json === 'object') {
      if (json.jsonMLValue) {
        return {
          text: cleanText(extractText(json.jsonMLValue)),
          imageURLs: extractImageURLs(json.jsonMLValue),
        };
      }
      if (json.htmlValue) return parseHTMLLike(json.htmlValue);
    }
  } catch { /* not JSON */ }

  // 2) HTML / Markdown
  return parseHTMLLike(description);
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value === '/' ? '' : value;
  if (!Array.isArray(value) || value.length === 0) return '';
  const tag = value[0];
  if (typeof tag !== 'string') return '';
  if (['img', 'br', 'hr', 'input'].includes(tag)) return '';
  const children = value.length >= 2 && typeof value[1] === 'object' && !Array.isArray(value[1])
    ? value.slice(2) : value.slice(1);
  const joined = children.map(extractText).join('');
  const blocks = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote']);
  if (blocks.has(tag) && joined) return joined + '\n';
  return joined;
}

function extractImageURLs(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  const tag = value[0];
  if (typeof tag !== 'string') return [];
  const urls: string[] = [];
  if (tag === 'img' || tag === 'image') {
    const attrs = (value.length >= 2 && typeof value[1] === 'object' && !Array.isArray(value[1]))
      ? value[1] as Record<string, unknown> : {};
    if (typeof attrs.src === 'string') urls.push(attrs.src);
  }
  const children = value.length >= 2 && typeof value[1] === 'object' && !Array.isArray(value[1])
    ? value.slice(2) : value.slice(1);
  for (const child of children) urls.push(...extractImageURLs(child));
  return urls;
}

function parseHTMLLike(text: string): ParsedDescription {
  const urls: string[] = [];
  // HTML img src
  const htmlRe = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = htmlRe.exec(text))) urls.push(m[1]);
  // Markdown ![](url)
  const mdRe = /!\[[^\]]*\]\(([^)]+)\)/g;
  while ((m = mdRe.exec(text))) urls.push(m[1]);

  let body = text;
  body = body.replace(/<img\b[^>]*>/gi, '');
  body = body.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  body = body.replace(/<[^>]+>/g, '');
  return { text: cleanText(body), imageURLs: urls };
}

function cleanText(text: string): string {
  let r = text;
  const entities: Record<string, string> = {
    '&nbsp;': ' ', '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': "'",
  };
  for (const [e, rep] of Object.entries(entities)) {
    r = r.split(e).join(rep);
  }
  r = r.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return r;
}
