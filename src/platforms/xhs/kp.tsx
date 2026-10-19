/**
 * 小红书卡片 × 排版引擎的接入层（平台侧唯一翻译位）。
 *
 * 高内聚低耦合原则的落点：
 * - src/core/typeset/* 是纯计算层：runs/宽度/字体 → 断好的行；不依赖 React/平台样式
 * - 本文件只做三件「翻译」：
 *     ① 行内 HTML → TypesetRun[]（kind = 原始标签名，样式语义留在 index.css）
 *     ② kind → 度量字体（与 CSS 渲染严格同参：雅黑→文楷、code 0.9em、strong 700、a 500）
 *     ③ TypesetLine → 带样式的行 HTML（重建原标签，行首悬挂用负 margin 实现）
 * - 内容宽度由卡片根自测 + Context 下发（预览/度量层/导出三处同一数据源）
 */
import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  DEFAULT_CONFIG,
  itemize,
  layout,
  resetMeasureCache,
  type TypesetConfig,
  type TypesetRun,
  type TypesetSeg,
  type TypesetLine,
} from '../../core/typeset'

export const MONO = 'JetBrains Mono, Consolas, monospace'

/* ---------- 字体就绪信号：以 fallback 流畅渲染，就绪后无感切换 ---------- */

let readyState = false
let readyPromise: Promise<void> | null = null

const ensureFontsReady = () => {
  if (!readyPromise) {
    readyPromise = Promise.allSettled([
      document.fonts.load('400 34px "LXGW WenKai"'),
      document.fonts.load('700 34px "LXGW WenKai"'),
      document.fonts.load('500 34px "LXGW WenKai"'),
    ]).then(() => {
      resetMeasureCache()
      readyState = true
    })
  }
  return readyPromise
}

const useTypesetReady = () => {
  const [ready, setReady] = useState(readyState)
  useEffect(() => {
    if (readyState) return
    let alive = true
    ensureFontsReady().then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])
  return ready
}

/* ---------- 内容宽度：卡片根自测，Context 下发 ---------- */

export const TypesetWidthCtx = createContext(0)

/* ---------- ① 行内 HTML → runs（DOM 解析，kind = 原始标签名） ---------- */

const runsFromInlineHtml = (html: string): TypesetRun[] => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const runs: TypesetRun[] = []
  const walk = (node: Node, kind: string, attrs?: Record<string, string>) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent ?? ''
      if (t) runs.push({ text: t, kind, attrs })
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    const k = el.tagName.toLowerCase()
    const a = k === 'a' ? { href: el.getAttribute('href') ?? '#', title: el.getAttribute('title') ?? '' } : undefined
    el.childNodes.forEach(c => walk(c, k, a))
  }
  walk(doc.body, 'text')
  return runs
}

/* ---------- ② kind → 度量字体（与 index.css [data-xhs-theme] 同参） ---------- */

interface BodyMetrics {
  size: number
  letterSpacing: number
  fontFamily: string
}

const fontFor = (kind: string, B: BodyMetrics) => ({
  family: kind === 'code' ? MONO : B.fontFamily,
  weight: kind === 'strong' ? 700 : kind === 'a' ? 500 : 400,
  size: kind === 'code' ? B.size * 0.9 : B.size,
  letterSpacing: B.letterSpacing,
})

/* code 行内饰带：padding 1px 12px + 1px border ×2 侧（CSS 默认 slice 行为 = 每行片段只带自己那侧） */
const CODE_PAD_X = 12 + 12 + 2
const runPad = (runs: TypesetRun[]) =>
  runs.map(r => (r.kind === 'code' ? { ...r, padStart: Math.ceil(CODE_PAD_X / 2), padEnd: Math.ceil(CODE_PAD_X / 2) } : r))

/* ---------- ③ 行 → 带样式的 HTML ---------- */

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const segHtml = (s: TypesetSeg, runs: TypesetRun[]): string => {
  if (s.gapAfter) return `<i data-xhs-gap style="display:inline-block;width:${s.gapAfter}px"></i>`
  const run = runs[s.run]!
  const text = escapeHtml(s.text)
  const kind = run.kind
  let core: string
  if (kind === 'text') core = text
  else if (kind === 'a') {
    const href = escapeHtml(run.attrs?.href ?? '#')
    core = `<a href="${href}">${text}</a>`
  } else core = `<${kind}>${text}</${kind}>` /* strong / em / code（样式由 [data-xhs-theme] CSS 提供） */
  // 挤压/悬挂落地：负 margin 实现位移（左移=挤压起始标点/行首悬挂；右移=闭合标点右空白压缩）
  const wrap = (core: string) => {
    const styles: string[] = []
    if (s.shiftLeft) styles.push(`margin-left:-${s.shiftLeft}px`)
    if (s.shiftRight) styles.push(`margin-right:-${s.shiftRight}px`)
    return styles.length ? `<span style="${styles.join(';')}">${core}</span>` : core
  }
  return wrap(core)
}

const lineHtml = (ln: TypesetLine, runs: TypesetRun[]): string => {
  const inner = ln.segs.map(s => segHtml(s, runs)).join('')
  return ln.hangStartPx > 0 ? `<span style="margin-left:-${ln.hangStartPx}px">${inner}</span>` : inner
}

/* ---------- 布局缓存（键含字体关键量，主题/字号切换自动失效） ---------- */

const cache = new Map<string, TypesetLine[]>()
const CACHE_MAX = 400

const layoutCached = (key: string, build: () => TypesetLine[]): TypesetLine[] => {
  const hit = cache.get(key)
  if (hit) return hit
  const out = build()
  if (cache.size > CACHE_MAX) cache.clear()
  cache.set(key, out)
  return out
}

/* ---------- KP 段落组件 ---------- */

export interface KPParagraphProps {
  theme: {
    id: string
    fontFamily: string
    palette: { text: string }
    layout: { body: { size: number; lineRatio: number; letterSpacing: number; align: string } }
  }
  text?: string
  html?: string
  className?: string
}

/**
 * KP 排版段落。就绪前（字体未载/宽度未知）以浏览器流式排版兜底渲染，同帧无感切换。
 */
export const KPParagraph = ({ theme, text, html, className }: KPParagraphProps) => {
  const ready = useTypesetReady()
  const width = useContext(TypesetWidthCtx)
  const p = theme.palette
  const B = theme.layout.body

  const source = html ?? (text ? `<span>${text}</span>` : '')
  const runs = useMemo(() => runPad(runsFromInlineHtml(source)), [source])

  const lines = useMemo(() => {
    if (!ready || width <= 0) return null
    const metrics = { size: B.size, letterSpacing: B.letterSpacing, fontFamily: theme.fontFamily }
    return layoutCached(
      `${theme.id}|${theme.fontFamily}|${B.size}|${B.letterSpacing}|${Math.round(width)}|${source}`,
      () => {
        const cfg: TypesetConfig = DEFAULT_CONFIG
        const tokens = itemize(runs, kind => fontFor(kind, metrics), B.size, cfg)
        const res = layout(tokens, width, B.size, { ...cfg, overflow: 'forbid' })
        return res.lines
      },
    )
  }, [ready, width, runs, B.size, B.letterSpacing, theme.fontFamily, theme.id, source])

  const wrapperStyle: CSSProperties = {
    color: p.text,
    fontSize: B.size,
    lineHeight: B.lineRatio,
    letterSpacing: B.letterSpacing,
    textAlign: 'left',
    wordBreak: 'normal',
    overflowWrap: 'break-word',
    lineBreak: 'strict',
  }

  if (!lines) {
    // 引擎未就绪：浏览器流式排版兜底（与正式渲染同字体同字号，行数一致后再切换）
    const fallback = { textAutospace: 'normal', textSpacingTrim: 'normal' } as CSSProperties
    return <div className={className} style={{ ...wrapperStyle, ...fallback }} dangerouslySetInnerHTML={{ __html: source }} />
  }

  return (
    <div
      className={`${className ?? ''} xhs-kp`}
      // 行级手动断行接管后，浏览器不再自行处理断行/压缩（budget 已精确建模）
      style={{ ...wrapperStyle, ...({ textAutospace: 'no-autospace', textSpacingTrim: 'space-all' } as CSSProperties) }}
    >
      {lines.map((ln, i) => (
        <div
          key={i}
          className="xhs-kp-line"
          style={{ whiteSpace: 'nowrap' }}
          dangerouslySetInnerHTML={{ __html: lineHtml(ln, runs) }}
        />
      ))}
    </div>
  )
}
