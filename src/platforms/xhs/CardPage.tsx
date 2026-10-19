import katex from 'katex'
import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { KPParagraph, TypesetWidthCtx } from './kp'
import { renderInline, stripInline } from '../../core/document/parse'
import { highlightCodeLines } from '../../core/highlight'
import { advanceWidth } from '../../core/typeset'
import type { XhsCard, XhsCardBlock } from './layout'
import type { XhsCardTheme, XhsHeadingStyle } from './theme'
import { xhsMermaidVars } from './theme'
import { useDiagramSvg } from '../shared-blocks'

/**
 * 小红书卡片渲染器。
 * 按「原生 1080 宽」渲染逻辑像素；预览/导出只做 transform 缩放，保持像素一一对应。
 * 所有视觉量均来自 theme.layout 版式参数；本文件不含布局魔法数字。
 */

// ---------- 异步内容块 ----------

const MathBlock = ({ text, theme }: { text: string; theme: XhsCardTheme }) => {
  const htmlRef = { current: '' }
  try {
    htmlRef.current = katex.renderToString(text, { displayMode: true, throwOnError: false })
  } catch {
    htmlRef.current = `<code style="color:${theme.palette.accent}">KaTeX 渲染失败：${stripInline(text)}</code>`
  }
  return (
    <div
      className="xhs-math"
      style={{
        color: theme.palette.text,
        // KaTeX 自带 .katex { font-size: 1.21em }，除回去抵消——
        // LaTeX 惯例展示公式与正文同字号（此前 0.9×正文×1.21 ≈ 1.09×正文，偏大）
        fontSize: theme.layout.body.size / 1.21,
        overflowX: 'auto',
        padding: '8px 0',
      }}
      dangerouslySetInnerHTML={{ __html: htmlRef.current }}
    />
  )
}

const MermaidBlock = ({ text, theme }: { text: string; theme: XhsCardTheme }) => {
  const { svg, error } = useDiagramSvg('mermaid', text, { mermaidVars: xhsMermaidVars(theme) })
  if (error)
    return (
      <div style={{ fontFamily: 'monospace', fontSize: 24, color: '#c0564e', whiteSpace: 'pre-wrap' }}>
        Mermaid 语法错误：{error}
      </div>
    )
  if (!svg)
    return (
      <div style={{ fontFamily: 'monospace', fontSize: 24, color: '#999', whiteSpace: 'pre-wrap' }}>
        {text}
      </div>
    )
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: svg }} />
  )
}

/** PlantUML：走公共渲染服务 Kroki（网络依赖，MVP 够用） */
const PlantumlBlock = ({ text }: { text: string }) => {
  const { svg, error } = useDiagramSvg('plantuml', text)
  if (error) return <div style={{ fontSize: 24, color: '#c0564e', whiteSpace: 'pre-wrap' }}>{error}</div>
  if (!svg)
    return <div style={{ fontFamily: 'monospace', fontSize: 24, color: '#999' }}>{text}</div>
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: svg }} />
  )
}

// ---------- 标题（分级装饰） ----------

/** Phycat 标题尾部小圆点图标（h3 = 三点 L 形，h4 = 2×2 四点），亮色板 #ffb7cd@0.5 的主题版 */
const HEAD_DOTS_SVG: Record<string, string> = {
  h3: `<svg viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'><path d='M4.571 25.143c-1.257 0-2.286 1.029-2.286 2.286s1.029 2.286 2.286 2.286 2.286-1.029 2.286-2.286-1.029-2.286-2.286-2.286zM4.571 18.286c-1.257 0-2.286 1.029-2.286 2.286s1.029 2.286 2.286 2.286 2.286-1.029 2.286-2.286-1.029-2.286-2.286-2.286zM11.429 25.143c-1.257 0-2.286 1.029-2.286 2.286s1.029 2.286 2.286 2.286 2.286-1.029 2.286-2.286-1.029-2.286-2.286-2.286z'/></svg>`,
  h4: `<svg viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'><path d='M4.571 25.143c-1.257 0-2.286 1.029-2.286 2.286s1.029 2.286 2.286 2.286 2.286-1.029 2.286-2.286-1.029-2.286-2.286-2.286zM4.571 18.286c-1.257 0-2.286 1.029-2.286 2.286s1.029 2.286 2.286 2.286 2.286-1.029 2.286-2.286-1.029-2.286-2.286-2.286zM11.429 25.143c-1.257 0-2.286 1.029-2.286 2.286s1.029 2.286 2.286 2.286 2.286-1.029 2.286-2.286-1.029-2.286-2.286-2.286zM11.429 22.857c1.257 0 2.286-1.029 2.286-2.286s-1.029-2.286-2.286-2.286-2.286 1.029-2.286 2.286 1.029 2.286 2.286 2.286z'/></svg>`,
}
const dotsIconStyle = (color: string, icon: 'h3' | 'h4' = 'h3'): CSSProperties => ({
  display: 'inline-block',
  width: '1.2em',
  height: '1.2em',
  // 墨迹中心校准：提升量 = 墨迹中心(文楷实测均值 0.355em) − 图标半高(0.6em) = −0.245em
  verticalAlign: '-0.245em',
  marginLeft: '0.38em',
  backgroundColor: color,
  opacity: 0.5,
  WebkitMask: `url("data:image/svg+xml;utf8,${HEAD_DOTS_SVG[icon]!}") no-repeat center / contain`,
  mask: `url("data:image/svg+xml;utf8,${HEAD_DOTS_SVG[icon]!}") no-repeat center / contain`,
})

const decoStyle = (style: XhsHeadingStyle, theme: XhsCardTheme): CSSProperties => {
  const p = theme.palette
  switch (style.decoration) {
    case 'bar':
      return {
        borderLeft: `8px solid ${p.accent}`,
        paddingLeft: 22,
        borderRadius: 4,
      }
    case 'underline':
      return {
        textDecorationLine: 'underline',
        textDecorationColor: `${p.accent}66`,
        textDecorationThickness: 6,
        textUnderlineOffset: 10,
      }
    /* twin / dots / pill 需要真实 DOM（双条/圆点图标/胶囊条），在 heading 分支里处理 */
    default:
      return {}
  }
}

/** 卡片根上挂 CSS 变量：行内元素着色（strong/em/行内代码/链接）由 index.css 消费 */export const xhsCssVars = (theme: XhsCardTheme): CSSProperties =>
  ({
    '--xhs-accent': theme.palette.accent,
    '--xhs-strong': theme.palette.strong,
    '--xhs-italic': theme.palette.italic,
    '--xhs-italic-wave': `${theme.palette.italic}66`,
    '--xhs-heading': theme.palette.heading,
  }) as CSSProperties

// ---------- 基础块 ----------

/* 正文段落已由 KPParagraph（kp.tsx，KP 型全局最优断行）接管；
   浏览器流式排版版式保留在其内部兜底分支，此处不再需要独立组件 */

export const BlockView = ({
  block,
  theme,
  start,
}: {
  block: XhsCardBlock
  theme: XhsCardTheme
  /** 是否为页首块：段前距（标题/分隔线/图片的 marginTop）在页首应丢弃，空间还给内容 */
  start?: boolean
}) => {
  const p = theme.palette
  const L = theme.layout
  const B = L.body

  switch (block.type) {
    case 'heading': {
      // 首个 h1 归封面；正文中的 h1 = 章节开头档，h5/h6 并入 h4 档
      const key = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : block.level === 3 ? 'h3' : 'h4'
      const st = L.headings[key]
      const decor = decoStyle(st, theme)
      const textStyle: CSSProperties = {
        color: p.heading,
        fontSize: B.size * st.sizeRatio,
        lineHeight: B.lineRatio * 0.82,
        letterSpacing: B.letterSpacing,
        fontWeight: st.weight,
        textAlign: st.align,
        margin: 0,
        marginTop: start ? 0 : st.spaceBefore,
        marginBottom: st.spaceAfter,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }
      if (st.decoration === 'pill') {
        // Phycat h1：居中大标题 + 底部居中渐变胶囊条（全部 em 派生，随字号比缩放）
        return (
          <div style={{ ...textStyle, paddingBottom: '0.46em' }}>
            <div>{block.text}</div>
            <div
              style={{
                width: '1.55em',
                height: '0.155em',
                borderRadius: '0.2em',
                margin: '0.46em auto 0',
                background: `linear-gradient(90deg, ${p.accent}66, ${p.accent}, ${p.accent}66)`,
              }}
            />
          </div>
        )
      }
      if (st.decoration === 'twin') {
        // Phycat h2「双子塔」：装饰为行内元素 + 精确 vertical-align 长度。
        // 提升量 = 墨迹中心（canvas 实测 文楷实测：CJK 0.368/拉丁 0.342，取均值 0.355em）
        // − 装饰半高，em 常量随字号比缩放；悬挂缩进保证首行条贴左缘、折行对齐
        return (
          <div style={{ ...textStyle, paddingLeft: '0.85em', textIndent: '-0.85em' }}>
            <i
              style={{
                display: 'inline-block',
                width: '0.213em',
                height: '1em',
                borderRadius: '0.107em',
                background: p.accent,
                verticalAlign: '-0.145em',
                marginRight: '0.128em',
                textIndent: 0,
              }}
            />
            <i
              style={{
                display: 'inline-block',
                width: '0.085em',
                height: '0.6em',
                borderRadius: '0.09em',
                background: p.italic,
                opacity: 0.6,
                verticalAlign: '0.055em',
                marginRight: '0.427em',
                textIndent: 0,
              }}
            />
            {block.text}
          </div>
        )
      }
      if (st.decoration === 'dots') {
        // Phycat h3/h4：细竖条 + 文字 + 尾部小圆点图标（同上墨迹中心校准）
        const isH4 = key === 'h4'
        return isH4 ? (
          <div style={{ ...textStyle }}>
            {block.text}
            <i style={dotsIconStyle(p.accent, 'h4')} />
          </div>
        ) : (
          <div style={{ ...textStyle, paddingLeft: '0.71em', textIndent: '-0.71em' }}>
            <i
              style={{
                display: 'inline-block',
                width: '0.19em',
                height: '1em',
                borderRadius: '0.1em',
                background: p.accent,
                verticalAlign: '-0.145em',
                marginRight: '0.52em',
                textIndent: 0,
              }}
            />
            {block.text}
            <i style={dotsIconStyle(p.accent, 'h3')} />
          </div>
        )
      }
      return (
        <h2 style={{ ...decor, ...textStyle }}>
          {block.text}
        </h2>
      )
    }
    case 'paragraph':
      return <KPParagraph theme={theme} text={renderInline(block.text)} />
    case 'paraSplit':
      return <KPParagraph theme={theme} html={block.html} />
    case 'quote':
      return (
        <blockquote
          style={{
            margin: `${L.blocks.marginY}px 0`,
            padding: `${Math.round(L.quote.pad * 0.75)}px ${Math.round(L.quote.pad * 0.9)}px`,
            background: p.quoteBg,
            borderRadius: L.quote.radius,
            border: `1px solid ${p.italic}4d`,
            color: p.text,
            fontSize: B.size * 0.95,
            lineHeight: B.lineRatio,
            letterSpacing: B.letterSpacing,
            display: 'flex',
            gap: 18,
            alignItems: 'flex-start',
          }}
        >
          <i
            style={{
              fontStyle: 'normal',
              fontSize: B.size * 0.62,
              lineHeight: 1.2,
              filter: 'grayscale(1)',
              opacity: 0.8,
              transform: 'rotate(30deg)',
              flexShrink: 0,
            }}
          >
            💡
          </i>
          <div style={{ flex: 1, minWidth: 0 }}>
            {block.text.split('\n').map((line, i) => (
              <div key={i} dangerouslySetInnerHTML={{ __html: renderInline(line) }} />
            ))}
          </div>
        </blockquote>
      )
    case 'code': {
      // 编辑模式同款代码部件：浅色系 + 语言名左上 + macOS 红绿灯 + 行号 + 语法高亮；
      // 饰带颜色从主题 accent 派生（8 位 hex alpha），各预设自带同族色调
      const fs = B.size * L.code.sizeRatio
      const accent = theme.palette.accent
      const MONO = 'JetBrains Mono, Consolas, monospace'
      const lines = highlightCodeLines((block.lang ?? '').toLowerCase(), block.text)
      const head =
        L.code.showLang && block.lang ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: `${Math.round(L.code.pad * 0.28)}px ${Math.round(L.code.pad * 0.7)}px`,
              background: `${accent}1a`,
              borderBottom: `1px solid ${accent}38`,
            }}
          >
            <span
              style={{
                fontSize: fs * 0.92,
                fontWeight: 600,
                letterSpacing: '0.02em',
                fontFamily: MONO,
                color: accent,
              }}
            >
              {block.lang}
            </span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: fs * 0.5 }}>
              {['#ff5f57', '#febc2e', '#28c840'].map(c => (
                <i
                  key={c}
                  style={{
                    display: 'block',
                    width: fs * 0.8,
                    height: fs * 0.8,
                    borderRadius: '50%',
                    background: c,
                    boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.14)',
                  }}
                />
              ))}
            </span>
          </div>
        ) : null
      return (
        <div
          className="xhs-code"
          style={{
            margin: `${L.blocks.marginY}px 0`,
            border: `1px solid ${accent}3d`,
            borderRadius: L.code.radius,
            overflow: 'hidden',
            background: `${accent}09`,
            color: theme.palette.text,
            fontFamily: MONO,
            fontSize: fs,
            lineHeight: 1.55,
          }}
        >
          {head}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'max-content minmax(0, 1fr)',
              alignItems: 'baseline',
              padding: `${Math.round(L.code.pad * 0.36)}px ${Math.round(L.code.pad * 0.7)}px ${Math.round(L.code.pad * 0.43)}px`,
            }}
          >
            {lines.map((ln, i) => (
              <Fragment key={i}>
                <span
                  style={{
                    paddingRight: 14,
                    textAlign: 'right',
                    fontSize: fs * 0.88,
                    color: `${accent}57`,
                    whiteSpace: 'pre',
                    userSelect: 'none',
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                  dangerouslySetInnerHTML={{ __html: ln }}
                />
              </Fragment>
            ))}
          </div>
        </div>
      )
    }
    case 'math':
      return <MathBlock text={block.text} theme={theme} />
    case 'mermaid':
      return (
        <figure style={{ margin: `${L.blocks.marginY}px 0` }}>
          <MermaidBlock text={block.text} theme={theme} />
        </figure>
      )
    case 'plantuml':
      return (
        <figure style={{ margin: `${L.blocks.marginY}px 0` }}>
          <PlantumlBlock text={block.text} />
        </figure>
      )
    case 'list':
    case 'listSlice': {
      const data = block.type === 'listSlice' ? block.block : block
      const from = block.type === 'listSlice' ? block.from : 0
      const to = block.type === 'listSlice' ? block.to : data.items.length
      const ordered = block.type === 'listSlice' ? data.ordered : block.ordered
      const shown = block.type === 'listSlice' ? data.items.slice(from, to) : data.items
      /* 悬挂缩进槽位 = 标记实宽 + 光学间隙（CLREQ：编号与内容空隙不宜过宽，
         标记列与正文左缘齐平）。固定槽位会让 • 过散、双位数撞正文。
         数字自带句点留白 → 间隙 0.3em；圆点墨迹窄 → 0.55em 光学间隙。 */
      const markerSize = B.size * (ordered ? 1.12 : 1.26)
      const markerFont = { family: theme.fontFamily, weight: 700, size: markerSize, letterSpacing: 0 }
      const labels = shown.map((_, i) => (ordered ? `${from + i + 1}.` : theme.bulletSymbol || '•'))
      const maxMarker = labels.reduce((m, l) => Math.max(m, advanceWidth(l, markerFont)), 0)
      const indent = Math.max(L.list.indent, Math.ceil(maxMarker + B.size * (ordered ? 0.3 : 0.55)))
      return (
        <div style={{ display: 'grid', gap: L.list.itemGap }} data-list>
          {shown.map((item, i) => (
            <div
              key={i}
              style={{
                // 挂起缩进：首行负 textIndent 拉回圆点，折行对齐正文
                paddingLeft: indent,
                textIndent: -indent,
                display: 'block',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  textIndent: 0,
                  width: indent,
                  marginRight: 0,
                  color: p.accent,
                  fontWeight: 700,
                  fontSize: markerSize,
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                }}
              >
                {labels[i]}
              </span>
              <span
                style={{
                  display: 'inline',
                  textIndent: indent,
                  color: p.text,
                  fontSize: B.size,
                  lineHeight: B.lineRatio,
                  letterSpacing: B.letterSpacing,
                }}
                dangerouslySetInnerHTML={{ __html: renderInline(item) }}
              />
            </div>
          ))}
        </div>
      )
    }
    case 'table':
      return (
        <div
          style={{
            margin: `${L.blocks.marginY}px 0`,
            overflowX: 'auto',
            borderRadius: 10,
            border: `1px solid ${p.muted}2e`,
            background: '#ffffff40',
          }}
        >
          <table
            style={{
              borderCollapse: 'collapse',
              width: '100%',
              fontSize: B.size * L.table.sizeRatio,
              fontFamily: theme.fontFamily,
              lineHeight: 1.8,
            }}
          >
            <thead>
              <tr>
                {block.head.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: 'left',
                      padding: `${L.table.cellPad * 0.85}px ${L.table.cellPad}px`,
                      background: `${p.accent}0d`,
                      borderBottom: `1px solid ${p.accent}26`,
                      color: p.heading,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                    dangerouslySetInnerHTML={{ __html: renderInline(h) }}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r, ri) => (
                <tr key={ri} style={{ borderTop: `1px solid ${p.muted}1f` }}>
                  {r.map((c, ci) => (
                    <td
                      key={ci}
                      style={{
                        padding: `${L.table.cellPad * 0.7}px ${L.table.cellPad}px`,
                        color: p.text,
                        letterSpacing: B.letterSpacing,
                      }}
                      dangerouslySetInnerHTML={{ __html: renderInline(c) }}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'image':
      return (
        <img
          src={block.url}
          alt={block.alt ?? ''}
          style={imageStyle(L, p.muted, start)}
        />
      )
    case 'divider':
      return (
        <div
          style={{
            position: 'relative',
            height: 22,
            marginTop: start ? 0 : L.divider.gapY,
            marginBottom: L.divider.gapY,
          }}
        >
          {/* Phycat hr：两端渐隐的主色细线 + 中央 45° 菱形 */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${p.accent}, transparent)`,
              opacity: 0.45,
            }}
          />
          <i
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%) rotate(45deg)',
              width: 16,
              height: 16,
              border: `3px solid ${p.accent}`,
              background: p.bg,
              boxSizing: 'border-box',
            }}
          />
        </div>
      )
    case 'pagebreak':
      return null
  }
}

/** 图片版式：通栏探出页边距，或对齐内容区 */
const imageStyle = (
  L: XhsCardTheme['layout'],
  muted: string,
  start?: boolean,
): CSSProperties => {
  const base: CSSProperties = {
    display: 'block',
    marginTop: start ? 0 : L.image.marginY,
    marginBottom: L.image.marginY,
    borderRadius: L.image.radius,
    maxWidth: L.image.fullBleed ? 'none' : '100%',
    boxSizing: 'border-box',
  }
  if (L.image.fullBleed)
    Object.assign(base, {
      width: `calc(100% + ${L.padding.left + L.padding.right}px)`,
      marginLeft: -L.padding.left,
    })
  if (L.image.outline)
    Object.assign(base, {
      outlineWidth: 1,
      outlineStyle: 'solid',
      outlineColor: `${muted}44`,
      outlineOffset: -1,
    })
  return base
}

// ---------- 页眉 / 水印 ----------

const CardHeader = ({ card, theme }: { card: XhsCard; theme: XhsCardTheme }) => {
  const L = theme.layout
  const p = theme.palette
  if (!L.header.showTag && !L.header.showPageNum) return null
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        height: L.header.height,
      }}
    >
      <div style={{ color: p.accent, fontSize: 28, letterSpacing: 5, fontWeight: 600 }}>
        {L.header.showTag && card.meta?.tags[0] ? `#${card.meta.tags[0]}#` : ''}
      </div>
      <div style={{ color: p.muted, fontSize: 28, letterSpacing: 2 }}>
        {L.header.showPageNum ? (
          <>
            {card.page} <span style={{ opacity: 0.5 }}>/ {card.totalPages ?? card.page}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}

const Watermark = ({ theme, text }: { theme: XhsCardTheme; text?: string }) => {
  const L = theme.layout
  const content = (text ?? '').trim()
  if (!L.watermark.enabled || !content) return null
  const pos: Record<string, CSSProperties> = {
    left: { left: 'auto', transform: 'none' },
    center: { left: '50%', transform: 'translateX(-50%)' },
    right: { right: 'auto', left: 'auto' },
  }
  return (
    <div
      style={{
        position: 'absolute',
        bottom: Math.max(24, theme.layout.padding.bottom * 0.32),
        fontSize: 26,
        color: theme.palette.muted,
        opacity: 0.85,
        letterSpacing: 1,
        whiteSpace: 'nowrap',
        ...pos[L.watermark.pos],
      }}
    >
      {content}
    </div>
  )
}

// ---------- 封面（三种版式骨架） ----------

const CoverCard = ({ card, theme, watermark }: { card: XhsCard; theme: XhsCardTheme; watermark?: string }) => {
  const p = theme.palette
  const L = theme.layout
  const B = L.body
  const titleSize = B.size * 2.1
  const meta = card.meta
  const title = (
    <h1
      style={{
        color: p.heading,
        fontSize: titleSize,
        lineHeight: 1.32,
        fontWeight: 800,
        margin: 0,
        textAlign: L.cover === 'center' ? 'center' : 'left',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {meta?.title ?? ''}
    </h1>
  )
  const tag = meta?.tags[0] ? (
    <div style={{ letterSpacing: 5, color: p.accent, fontSize: 32, fontWeight: 700 }}>
      #{meta.tags[0].toUpperCase()}#
    </div>
  ) : null
  const subTags =
    meta && meta.tags.length > 1 ? (
      <div style={{ fontSize: 30, color: p.muted, letterSpacing: 3 }}>
        {meta.tags.slice(1).join('  /  ')}
      </div>
    ) : null
  const author = meta?.author ? (
    <div style={{ fontSize: 28, color: p.muted }}>{meta.author}</div>
  ) : null

  return (
    <div
      data-xhs-card
      data-xhs-theme={theme.id}
      style={{
        width: '100%',
        height: '100%',
        background: p.bg,
        padding: L.padding.top,
        paddingLeft: L.padding.left,
        paddingRight: L.padding.right,
        paddingBottom: L.padding.bottom,
        fontFamily: theme.fontFamily,
        color: p.text,
        ...xhsCssVars(theme),
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent:
          L.cover === 'center' ? 'center' : L.cover === 'bottom' ? 'flex-end' : 'space-between',
        gap: 30,
      }}
    >
      {L.cover === 'bottom' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>{tag}{author}</div>
          {title}
          {subTags}
          <div style={{ width: 120, height: 10, borderRadius: 5, background: p.accent, marginTop: 24 }} />
        </>
      ) : L.cover === 'center' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'center' }}>{tag}</div>
          {title}
          {subTags}
          <div style={{ width: 120, height: 10, borderRadius: 5, background: p.accent, margin: '4px auto 0' }} />
          <div style={{ textAlign: 'center' }}>{author}</div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 30, marginTop: '4%' }}>
            {tag}
            {title}
            {subTags}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: '1%' }}>
            {author && <div style={{ fontSize: 28, color: p.muted }}>想法 {meta!.author}</div>}
            <div style={{ width: 120, height: 10, borderRadius: 5, background: p.accent }} />
          </div>
        </>
      )}
      <Watermark theme={theme} text={watermark} />
    </div>
  )
}

export const CardPage = ({ card, theme, watermark }: { card: XhsCard; theme: XhsCardTheme; watermark?: string }) => {
  const p = theme.palette
  const L = theme.layout
  /* KP 排版需要渲染前知道内容宽：卡片根自测（clientWidth − 左右 padding），
     ResizeObserver 跟随面板/页面比例变化，Context 下发给段落引擎 */
  const rootRef = useRef<HTMLDivElement>(null)
  const [contentWidth, setContentWidth] = useState(0)
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => setContentWidth(el.clientWidth - L.padding.left - L.padding.right)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [L.padding.left, L.padding.right])

  if (card.kind === 'cover') return <CoverCard card={card} theme={theme} />

  return (
    <div
      ref={rootRef}
      data-xhs-card
      data-xhs-theme={theme.id}
      style={{
        width: '100%',
        height: '100%',
        background: p.bg,
        color: p.text,
        fontFamily: theme.fontFamily,
        boxSizing: 'border-box',
        paddingTop: L.padding.top,
        paddingLeft: L.padding.left,
        paddingRight: L.padding.right,
        paddingBottom: L.padding.bottom,
        ...xhsCssVars(theme),
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 页眉（话题 + 页码）——显示开关与高度由 layout.header 驱动 */}
      <CardHeader card={card} theme={theme} />

      {/* 流式内容区：块间 gap 与分页装箱同源（paragraphSpacing）；
          子块 flex-shrink:0 —— overflow 容器（表格/代码/公式）在内容超高时必须溢出而非被压缩 */}
      <div className="xhs-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: L.body.paragraphSpacing }}>
        <TypesetWidthCtx.Provider value={contentWidth}>
          {card.blocks.map((b, i) => (
            <BlockView key={i} block={b} theme={theme} start={i === 0} />
          ))}
        </TypesetWidthCtx.Provider>
      </div>

      {L.watermark.enabled && <Watermark theme={theme} text={watermark} />}
    </div>
  )
}
