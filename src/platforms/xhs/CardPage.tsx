import katex from 'katex'
import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
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
  if (!L.header.showTag) return null
  // 页眉只保留话题标签（左）；页码移至下边距带右下角（CardFooter）
  const bandHeight = Math.max(24, L.padding.top - 8)
  const height = Math.min(L.header.height, bandHeight)
  return (
    <div
      style={{
        position: 'absolute',
        top: Math.max(4, Math.round((L.padding.top - height) / 2)),
        left: L.padding.left,
        right: L.padding.right,
        display: 'flex',
        alignItems: 'center',
        height,
        pointerEvents: 'none',
      }}
    >
      <div style={{ color: p.accent, fontSize: 28, letterSpacing: 5, fontWeight: 600 }}>
        {card.meta?.tags[0] ? `#${card.meta.tags[0]}#` : ''}
      </div>
    </div>
  )
}

const CardFooter = ({ card, theme, watermark }: { card: XhsCard; theme: XhsCardTheme; watermark?: string }) => {
  const L = theme.layout
  const p = theme.palette
  const showPage = L.header.showPageNum
  const showMark = L.watermark.enabled && (watermark ?? '').trim() !== ''
  if (!showPage && !showMark) return null
  const band = Math.max(12, Math.round((L.padding.bottom - 32) / 2))
  return (
    <div
      style={{
        position: 'absolute',
        left: L.padding.left,
        right: L.padding.right,
        bottom: band,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {showMark && L.watermark.pos === 'left' && <Watermark theme={theme} text={watermark} inline />}
      {showMark && L.watermark.pos === 'center' && (
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <Watermark theme={theme} text={watermark} inline />
        </div>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 24 }}>
        {showMark && L.watermark.pos === 'right' && <Watermark theme={theme} text={watermark} inline />}
        {showPage && (
          <span style={{ color: p.muted, opacity: 0.85, fontSize: 26, letterSpacing: 2, whiteSpace: 'nowrap' }}>
            {card.page} <span style={{ opacity: 0.5 }}>/ {card.totalPages ?? card.page}</span>
          </span>
        )}
      </div>
    </div>
  )
}

const Watermark = ({ theme, text, inline }: { theme: XhsCardTheme; text?: string; inline?: boolean }) => {
  const L = theme.layout
  const content = (text ?? '').trim()
  if (!L.watermark.enabled || !content) return null
  const pos: Record<string, CSSProperties> = {
    left: { left: 'auto', transform: 'none' },
    center: { left: '50%', transform: 'translateX(-50%)' },
    right: { right: 'auto', left: 'auto' },
  }
  if (inline) {
    return (
      <span
        style={{
          fontSize: 26,
          color: theme.palette.muted,
          opacity: 0.85,
          letterSpacing: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {content}
      </span>
    )
  }
  return (
    <div
      style={{
        position: 'absolute',
        // 水印住在下边距带内，垂直居中（行盒约 32px）
        bottom: Math.max(12, Math.round((theme.layout.padding.bottom - 32) / 2)),
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

// ---------- 封面（六套版式：经典 / 竖排 / 巨字 / 杂志 / 书封 / 索引） ----------
//
// 平面设计原则（来自书封/杂志封面方法论）：
// 1. 一版一概念：每套只讲一件事，装饰 ≤「细线 + 一个强调色块」
// 2. 字体即图形：中文大字的字号/字距/行距按展示级排版，标题是唯一主角
// 3. 留白是构图材料：标题落在视觉中心（约 42%），不是几何中心
// 4. 元素完整：标题 / 副标题 / 作者 / 标签 四件套在任何版式里都有位置；
//    缺省回退文档元数据，面板可独立编辑（coverText）
// 5. 克制：纸色 + 墨色 + 单一强调色；不用渐变堆叠、不用伪 3D

export interface CoverTextInfo {
  title: string
  subtitle: string
  author: string
  tags: string
}

/** 括号感知的平衡断行：封面巨字按语义块均分两行，不拆「（三）」这类成对符号 */
const splitCoverLines = (text: string, maxLines: number): string[] => {
  const chars = [...text]
  if (maxLines <= 1 || chars.length <= 6) return [text]
  // 语义块：成对括号整体成块，其余逐字
  const groups: string[] = []
  const openers = '（(《「『【〔'
  const closers = '）)》」』】〕'
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!
    const oi = openers.indexOf(c)
    if (oi >= 0) {
      let j = i + 1
      while (j < chars.length && chars[j] !== closers[oi]) j++
      if (j < chars.length) {
        groups.push(chars.slice(i, j + 1).join(''))
        i = j
        continue
      }
    }
    groups.push(c)
  }
  if (groups.length <= maxLines) return [groups.join('')]
  const per = Math.ceil(groups.length / maxLines)
  const out: string[] = []
  for (let i = 0; i < groups.length; i += per) out.push(groups.slice(i, i + per).join(''))
  return out
}

/** 标题行渲染：逐行 nowrap，避免浏览器把最后一个字单独折行（孤字） */
const TitleLines = ({ lines, align = 'left' }: { lines: string[]; align?: 'left' | 'center' }) => (
  <>
    {lines.map((l, i) => (
      <div key={i} style={{ whiteSpace: 'nowrap', textAlign: align }}>
        {l}
      </div>
    ))}
  </>
)

const CoverCard = ({
  theme,
  watermark,
  coverText,
}: {
  theme: XhsCardTheme
  watermark?: string
  coverText?: CoverTextInfo
}) => {
  const p = theme.palette
  const L = theme.layout
  const B = L.body
  const ct = coverText ?? { title: '', subtitle: '', author: '', tags: '' }

  /* 封面内容 100% 来自封面设置（coverText）——不再从正文首个 h1 / 文档元数据回退 */
  const tagList = ct.tags.trim() ? ct.tags.split(/[,，\s]+/).filter(Boolean) : []
  const titleText = ct.title.trim()
  const author = ct.author.trim()
  const subtitle = ct.subtitle.trim()
  /* 多个标签全部参与渲染：以 #标签# 空格串联（面板输入用逗号/空格分隔） */
  const tagLine = tagList.map(t => `#${t}#`).join('　')
  /* 封面标题行：
     - 手动断点优先：面板标题输入框里的换行即断行位置（换行符不渲染）
     - 未指定时自动平衡两行（括号整体不拆、避免孤字） */
  const manualLines = ct.title
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
  const titleLines = manualLines.length > 1 ? manualLines : splitCoverLines(titleText, [...titleText].length > 10 ? 2 : 1)
  const maxLineLen = Math.max(1, ...titleLines.map(l => [...l].length))
  /** 字号上限：保证最长一行放得下（宽 / 最长行字数），再受展示级基准封顶 */
  const fitCoverSize = (base: number, width = 904) => Math.min(Math.round(base), Math.round(width / maxLineLen))

  const hair = `${p.text}24`
  const ink = p.heading
  const accent = p.accent
  const mutedInk = p.muted

  const shellStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    background: p.bg,
    paddingTop: L.padding.top,
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
  }

  const tagEl = (size = 26, tracking = 5) =>
    tagLine ? <div style={{ letterSpacing: tracking, color: accent, fontSize: size, fontWeight: 700 }}>{tagLine.toUpperCase()}</div> : null
  const mastheadMark = (w = 44, h = 4) => <div style={{ width: w, height: h, borderRadius: 2, background: accent }} />

  let body: ReactNode

  if (L.coverStyle === 'vertical') {
    /* 竖排：汉字直排右起，左列为落款列（标签/副题/作者/印记），无落款时只留印章 */
    const n = [...titleText].length
    const vSize = n <= 8 ? Math.round(B.size * 2.2) : n <= 16 ? Math.round(B.size * 1.9) : Math.round(B.size * 1.55)
    body = (
      <div style={{ display: 'flex', flex: 1, flexDirection: 'row-reverse', justifyContent: 'flex-start', alignItems: 'stretch', gap: 52 }}>
        <div
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'upright',
            color: ink,
            fontSize: vSize,
            lineHeight: 1.5,
            fontWeight: 700,
            letterSpacing: 6,
            maxHeight: '100%',
            textAlign: 'start',
          }}
        >
          {titleText}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 24, paddingTop: 10, paddingBottom: 10 }}>
          {tagLine && (
            <div
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'upright',
                fontSize: 21,
                letterSpacing: 8,
                color: accent,
                fontWeight: 700,
                marginBottom: 'auto',
              }}
            >
              {tagLine}
            </div>
          )}
          {subtitle && (
            <div style={{ writingMode: 'vertical-rl', textOrientation: 'upright', fontSize: 19, letterSpacing: 4, color: mutedInk }}>
              {subtitle}
            </div>
          )}
          {author && (
            <div style={{ writingMode: 'vertical-rl', textOrientation: 'upright', fontSize: 20, letterSpacing: 6, color: mutedInk }}>
              {author}
            </div>
          )}
          <div style={{ width: 30, height: 30, borderRadius: 3, background: accent }} />
        </div>
      </div>
    )
  } else if (L.coverStyle === 'big') {
    /* 巨字：字体即图像——语义平衡断行（两句一行 / 两行均分），
       每行按版宽 ×1.02 计算字号，右缘轻微出血到页边距，由圆角裁切收边 */
    const size = Math.max(Math.round(B.size * 2.2), Math.min(Math.round((992 / maxLineLen) * 1.02), 240))
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {tagLine ? (
          <div style={{ fontSize: 20, letterSpacing: 6, color: accent, fontWeight: 700 }}>{tagLine}</div>
        ) : (
          mastheadMark(44, 4)
        )}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <h1
            style={{
              width: `calc(100% + ${L.padding.right}px)`,
              margin: 0,
              marginRight: -L.padding.right,
              color: ink,
              fontSize: size,
              lineHeight: 1.04,
              fontWeight: 800,
              letterSpacing: -2,
            }}
          >
            <TitleLines lines={titleLines} />
          </h1>
        </div>
        <div style={{ height: 1, background: hair, marginBottom: 22 }} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontSize: 22, letterSpacing: 3, color: mutedInk }}>
          <span>{author}</span>
          <span>{subtitle}</span>
        </div>
      </div>
    )
  } else if (L.coverStyle === 'editorial') {
    /* 杂志：报头 + 大幅左齐标题 + 强调线 + 页脚细线 */
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {tagLine ? tagEl(26, 6) : mastheadMark()}
        </div>
        <div style={{ height: 1, background: hair, marginTop: 26 }} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '100%', transform: 'translateY(-2%)' }}>
            <h1
              style={{
                color: ink,
                fontSize: fitCoverSize(B.size * 2.35),
                lineHeight: 1.3,
                fontWeight: 700,
                letterSpacing: 1.5,
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <TitleLines lines={titleLines} />
            </h1>
            <div style={{ width: 72, height: 6, borderRadius: 3, background: accent, marginTop: 44 }} />
            {subtitle && (
              <div style={{ marginTop: 36, fontSize: 26, lineHeight: 1.9, letterSpacing: 2, color: mutedInk }}>{subtitle}</div>
            )}
          </div>
        </div>
        <div style={{ height: 1, background: hair, marginBottom: 22 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 22, letterSpacing: 3, color: mutedInk }}>
          <span>{author}</span>
          <span style={{ width: 36, height: 2, background: `${accent}66` }} />
        </div>
      </div>
    )
  } else if (L.coverStyle === 'jacket') {
    /* 书封：细线内框 + 居中书名 + 版脚作者（装帧语言） */
    body = (
      <div style={{ flex: 1, border: `1.5px solid ${accent}4d`, padding: '56px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>{tagEl(24, 6)}</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', width: '100%', transform: 'translateY(-3%)' }}>
          <h1
            style={{
              color: ink,
              fontSize: fitCoverSize(B.size * 2.15, 805),
              lineHeight: 1.45,
              fontWeight: 700,
              letterSpacing: 2,
              margin: 0,
              width: '100%',
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            <TitleLines lines={titleLines} align="center" />
          </h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          {subtitle && <div style={{ fontSize: 24, letterSpacing: 3, color: mutedInk, lineHeight: 1.9 }}>{subtitle}</div>}
          <div style={{ width: 32, height: 2, borderRadius: 1, background: `${accent}80` }} />
          {author && <div style={{ fontSize: 22, letterSpacing: 3, color: mutedInk }}>{author}</div>}
        </div>
      </div>
    )
  } else if (L.coverStyle === 'index') {
    /* 索引：目录式结构——栏目字 + 细线 + 居中标题 + 标签索引行 */
    const rows = tagList.slice(0, 4)
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 20, letterSpacing: 6, color: accent }}>
          <span>目录</span>
          <span style={{ color: mutedInk, letterSpacing: 3 }}>{author}</span>
        </div>
        <div style={{ height: 1, background: hair, marginTop: 24 }} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1
            style={{
              color: ink,
              fontSize: fitCoverSize(B.size * 2.05),
              lineHeight: 1.36,
              fontWeight: 700,
              letterSpacing: 1.5,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            <TitleLines lines={titleLines} />
          </h1>
          {subtitle && <div style={{ marginTop: 30, fontSize: 24, letterSpacing: 2, color: mutedInk }}>{subtitle}</div>}

          {rows.length > 1 && (
            <div style={{ marginTop: 56 }}>
              {rows.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 26,
                    padding: '18px 0',
                    borderTop: `1px solid ${hair}`,
                    fontSize: 24,
                    letterSpacing: 2,
                    color: mutedInk,
                  }}
                >
                  <span style={{ color: accent, fontSize: 20, letterSpacing: 2 }}>{String(i + 1).padStart(2, '0')}</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ width: 48, height: 3, borderRadius: 2, background: accent }} />
        </div>
      </div>
    )
  } else {
    /* 经典：上置 / 居中 / 下置 */
    const title = (
      <h1
        style={{
          color: ink,
          fontSize: fitCoverSize(B.size * 2.1),
          lineHeight: 1.36,
          fontWeight: 800,
          letterSpacing: 2,
          margin: 0,
          textAlign: L.cover === 'center' ? 'center' : 'left',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        <TitleLines lines={titleLines} align={L.cover === 'center' ? 'center' : 'left'} />
      </h1>
    )
    body =
      L.cover === 'bottom' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {tagEl(26, 5)}
            {author && <div style={{ fontSize: 24, color: mutedInk, letterSpacing: 3 }}>{author}</div>}
          </div>
          {title}
          {subtitle && <div style={{ fontSize: 26, color: mutedInk, letterSpacing: 3 }}>{subtitle}</div>}
          <div style={{ width: 120, height: 7, borderRadius: 4, background: accent, marginTop: 26 }} />
        </>
      ) : L.cover === 'center' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'center' }}>{tagEl(26, 5)}</div>
          {title}
          {subtitle && <div style={{ fontSize: 26, color: mutedInk, letterSpacing: 3, textAlign: 'center' }}>{subtitle}</div>}
          <div style={{ width: 120, height: 7, borderRadius: 4, background: accent, margin: '4px auto 0' }} />
          <div style={{ textAlign: 'center', fontSize: 24, color: mutedInk, letterSpacing: 3 }}>{author}</div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: '4%' }}>
            {tagEl(26, 5)}
            {title}
            {subtitle && <div style={{ fontSize: 26, color: mutedInk, letterSpacing: 3 }}>{subtitle}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: '1%' }}>
            {author && <div style={{ fontSize: 24, color: mutedInk, letterSpacing: 3 }}>{author}</div>}
            <div style={{ width: 120, height: 7, borderRadius: 4, background: accent }} />
          </div>
        </>
      )
  }

  return (
    <div
      data-xhs-card
      data-xhs-theme={theme.id}
      style={{
        ...shellStyle,
        justifyContent: L.coverStyle === 'classic' ? (L.cover === 'center' ? 'center' : L.cover === 'bottom' ? 'flex-end' : 'space-between') : 'flex-start',
        gap: L.coverStyle === 'classic' ? 30 : 0,
      }}
    >
      {body}
      {L.watermark.cover && <Watermark theme={theme} text={watermark} />}
    </div>
  )
}

export const CardPage = ({ card, theme, watermark, coverText }: { card: XhsCard; theme: XhsCardTheme; watermark?: string; coverText?: CoverTextInfo }) => {
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

  if (card.kind === 'cover') return <CoverCard theme={theme} watermark={watermark} coverText={coverText} />

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
      {/* 页眉（话题标签）——显示开关与高度由 layout.header 驱动 */}
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

      {/* 页脚（下边距带）：水印 + 页码（右下） */}
      <CardFooter card={card} theme={theme} watermark={watermark} />
    </div>
  )
}
