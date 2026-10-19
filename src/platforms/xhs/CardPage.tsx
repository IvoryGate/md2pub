import katex from 'katex'
import type { CSSProperties } from 'react'
import { renderInline } from '../../core/document/parse'
import { stripInline } from '../../core/document/parse'
import type { XhsCard, XhsCardBlock } from './layout'
import type { XhsCardTheme, XhsHeadingStyle } from './theme'
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
        fontSize: theme.layout.body.size * 0.9,
        overflowX: 'auto',
        padding: '8px 0',
      }}
      dangerouslySetInnerHTML={{ __html: htmlRef.current }}
    />
  )
}

const MermaidBlock = ({ text }: { text: string }) => {
  const { svg, error } = useDiagramSvg('mermaid', text)
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
    default:
      return {}
  }
}

// ---------- 基础块 ----------

/** 正文段落：中英混排换行质量（CJK 禁则 + 英文整词断行 + 超长 URL 兜底） */
const ParaView = ({ theme, text, html }: { theme: XhsCardTheme; text?: string; html?: string }) => {
  const p = theme.palette
  const B = theme.layout.body
  return (
    <div
      className="xhs-paragraph"
      style={{
        color: p.text,
        fontSize: B.size,
        lineHeight: B.lineRatio,
        letterSpacing: B.letterSpacing,
        textAlign: B.align,
        wordBreak: 'normal',
        overflowWrap: 'break-word',
        lineBreak: 'strict',
      }}
      dangerouslySetInnerHTML={{ __html: html ?? text ?? '' }}
    />
  )
}

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
      // h1 归封面/文档标题；h2~h4 分级取样式，h5/h6 并入 h4 档
      const key: 'h2' | 'h3' | 'h4' = block.level === 2 ? 'h2' : block.level === 3 ? 'h3' : 'h4'
      const st = L.headings[key]
      const decor = decoStyle(st, theme)
      return (
        <h2
          style={{
            ...decor,
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
          }}
        >
          {block.text}
        </h2>
      )
    }
    case 'paragraph':
      return <ParaView theme={theme} text={renderInline(block.text)} />
    case 'paraSplit':
      return <ParaView theme={theme} html={block.html} />
    case 'quote':
      return (
        <blockquote
          style={{
            margin: 0,
            padding: `${L.quote.pad * 0.7}px ${L.quote.pad}px`,
            background: p.quoteBg,
            borderRadius: L.quote.radius,
            borderLeft: `8px solid ${p.accent}`,
            color: p.text,
            fontSize: B.size * 0.95,
            lineHeight: B.lineRatio,
            letterSpacing: B.letterSpacing,
          }}
        >
          {block.text.split('\n').map((line, i) => (
            <div key={i} dangerouslySetInnerHTML={{ __html: renderInline(line) }} />
          ))}
        </blockquote>
      )
    case 'code': {
      const codeStyle: CSSProperties = {
        margin: 0,
        background: p.codeBg,
        color: p.codeFg,
        padding: L.code.pad,
        borderRadius: L.code.radius,
        fontFamily: 'JetBrains Mono, Consolas, monospace',
        fontSize: B.size * L.code.sizeRatio,
        lineHeight: 1.55,
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }
      return L.code.showLang ? (
        <div
          style={{
            border: `1px solid ${p.codeBg}`,
            borderRadius: L.code.radius,
            overflow: 'hidden',
          }}
        >
          {block.lang ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '8px 16px',
                background: p.codeBg,
                color: `${p.codeFg}99`,
                fontSize: B.size * L.code.sizeRatio * 0.92,
                fontFamily: 'JetBrains Mono, Consolas, monospace',
              }}
            >
              {block.lang}
            </div>
          ) : null}
          <pre style={{ ...codeStyle, borderRadius: 0 }}>{block.text}</pre>
        </div>
      ) : (
        <pre style={codeStyle}>{block.text}</pre>
      )
    }
    case 'math':
      return <MathBlock text={block.text} theme={theme} />
    case 'mermaid':
      return <MermaidBlock text={block.text} />
    case 'plantuml':
      return <PlantumlBlock text={block.text} />
    case 'list':
    case 'listSlice': {
      const data = block.type === 'listSlice' ? block.block : block
      const from = block.type === 'listSlice' ? block.from : 0
      const to = block.type === 'listSlice' ? block.to : data.items.length
      const ordered = block.type === 'listSlice' ? data.ordered : block.ordered
      const shown = block.type === 'listSlice' ? data.items.slice(from, to) : data.items
      return (
        <div style={{ display: 'grid', gap: L.list.itemGap }} data-list>
          {shown.map((item, i) => (
            <div
              key={i}
              style={{
                // 挂起缩进：首行负 textIndent 拉回圆点，折行对齐正文
                paddingLeft: L.list.indent,
                textIndent: -L.list.indent,
                display: 'block',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  textIndent: 0,
                  width: L.list.indent,
                  marginRight: 0,
                  color: p.accent,
                  fontWeight: 700,
                  fontSize: B.size * (ordered ? 1.06 : 1),
                  textAlign: ordered ? 'left' : 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                {ordered ? `${from + i + 1}.` : theme.bulletSymbol || '•'}
              </span>
              <span
                style={{
                  display: 'inline',
                  textIndent: L.list.indent,
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
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              borderCollapse: 'collapse',
              width: '100%',
              fontSize: B.size * L.table.sizeRatio,
              fontFamily: theme.fontFamily,
              lineHeight: 1.5,
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
                      background: p.quoteBg,
                      color: p.heading,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      borderTopLeftRadius: i === 0 ? 10 : 0,
                      borderTopRightRadius: i === block.head.length - 1 ? 10 : 0,
                    }}
                    dangerouslySetInnerHTML={{ __html: renderInline(h) }}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r, ri) => (
                <tr key={ri} style={{ borderTop: `1px solid ${p.muted}33` }}>
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
            height: 2,
            marginTop: start ? 0 : L.divider.gapY,
            marginBottom: L.divider.gapY,
            background: p.muted,
            opacity: 0.35,
            borderRadius: 2,
          }}
        />
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
  if (card.kind === 'cover') return <CoverCard card={card} theme={theme} />

  return (
    <div
      data-xhs-card
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
        {card.blocks.map((b, i) => (
          <BlockView key={i} block={b} theme={theme} start={i === 0} />
        ))}
      </div>

      {L.watermark.enabled && <Watermark theme={theme} text={watermark} />}
    </div>
  )
}
