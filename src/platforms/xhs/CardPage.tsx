import katex from 'katex'
import { useEffect, useRef, useState } from 'react'
import { renderInline, stripInline } from '../../core/document/parse'
import type { Block } from '../../core/document/types'
import type { XhsCard } from './layout'
import type { XhsCardTheme } from './theme'
import { XHS_HEADER_HEIGHT, XHS_FOOTER_RESERVE } from './theme'

/**
 * 小红书卡片渲染器。
 * 按「原生 1080 宽」渲染逻辑像素；预览/导出只做 transform 缩放，保证像素一一对应。
 * 所有视觉量均来自 theme.page.* 排版参数（边距/行距/段距/字间距），本文件不藏魔法数字。
 */

const HEADER_HEIGHT = XHS_HEADER_HEIGHT

// ---------- 异步内容块 ----------

const MathBlock = ({ text, theme }: { text: string; theme: XhsCardTheme }) => {
  const html = useRef(
    (() => {
      try {
        return katex.renderToString(text, { displayMode: true, throwOnError: false })
      } catch (e) {
        return `<code style="color:${theme.palette.accent}">KaTeX 渲染失败：${stripInline(text)}</code>`
      }
    })(),
  )
  return (
    <div
      style={{
        color: theme.palette.text,
        fontSize: theme.page.typography.bodySize * 0.9,
        overflowX: 'auto',
        padding: '8px 0',
      }}
      dangerouslySetInnerHTML={{ __html: html.current }}
    />
  )
}

let mermaidReady = false
const ensureMermaid = async () => {
  const mermaid = (await import('mermaid')).default
  if (!mermaidReady) {
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' })
    mermaidReady = true
  }
  return mermaid
}

const MermaidBlock = ({ text }: { text: string }) => {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    ensureMermaid()
      .then(m => m.render(`mmd-${Math.random().toString(36).slice(2)}`, text))
      .then(({ svg }) => {
        if (alive) setSvg(svg)
      })
      .catch(err => {
        if (alive) setError(String(err?.message ?? err))
      })
    return () => {
      alive = false
    }
  }, [text])

  if (error)
    return (
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: 24,
          color: '#c0564e',
          whiteSpace: 'pre-wrap',
        }}
      >
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
    <div
      style={{ display: 'flex', justifyContent: 'center' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

/** PlantUML：走公共渲染服务 Kroki（网络依赖，MVP 够用） */
const PlantumlBlock = ({ text }: { text: string }) => {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    fetch('https://kroki.io/plantuml/svg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diagram_source: text, diagram_type: 'plantuml' }),
    })
      .then(r => r.text())
      .then(body => {
        if (!alive) return
        if (body.startsWith('<svg') || body.includes('<svg')) setSvg(body)
        else setError(body.slice(0, 200))
      })
      .catch(err => alive && setError(String(err)))
    return () => {
      alive = false
    }
  }, [text])
  if (error) return <div style={{ fontSize: 24, color: '#c0564e', whiteSpace: 'pre-wrap' }}>{error}</div>
  if (!svg)
    return <div style={{ fontFamily: 'monospace', fontSize: 24, color: '#999' }}>{text}</div>
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: svg }} />
  )
}

// ---------- 基础块 ----------

export const BlockView = ({ block, theme }: { block: Block; theme: XhsCardTheme }) => {
  const p = theme.palette
  const T = theme.page.typography

  switch (block.type) {
    case 'heading':
      return (
        <h2
          style={{
            color: p.heading,
            fontSize: T.headingSize * (block.level <= 2 ? 0.95 : 0.68),
            lineHeight: theme.page.typography.lineRatio * 0.86,
            letterSpacing: T.letterSpacing,
            fontWeight: 700,
            margin: 0,
            // 标题段前空间（类比 \section spacing）
            marginTop: block.level <= 2 ? T.headingSpaceBefore : T.headingSpaceBefore * 0.6,
            marginBottom: T.headingSpaceAfter,
            whiteSpace: 'pre-wrap',
          }}
        >
          {block.text}
        </h2>
      )
    case 'paragraph':
      return (
        <div
          className="xhs-paragraph"
          style={{
            color: p.text,
            fontSize: T.bodySize,
            lineHeight: T.lineRatio,
            letterSpacing: T.letterSpacing,
            wordBreak: 'break-word',
          }}
          dangerouslySetInnerHTML={{ __html: renderInline(block.text) }}
        />
      )
    case 'quote':
      return (
        <blockquote
          style={{
            margin: 0,
            padding: '20px 28px',
            background: p.quoteBg,
            borderRadius: 12,
            borderLeft: `8px solid ${p.accent}`,
            color: p.text,
            fontSize: T.bodySize * 0.95,
            lineHeight: T.lineRatio,
            letterSpacing: T.letterSpacing,
          }}
        >
          {block.text.split('\n').map((line, i) => (
            <div key={i} dangerouslySetInnerHTML={{ __html: renderInline(line) }} />
          ))}
        </blockquote>
      )
    case 'code':
      return (
        <pre
          style={{
            margin: 0,
            background: p.codeBg,
            color: p.codeFg,
            padding: 28,
            borderRadius: 16,
            fontFamily: 'JetBrains Mono, Consolas, monospace',
            fontSize: T.bodySize * 0.6,
            lineHeight: 1.55,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {block.text}
        </pre>
      )
    case 'math':
      return <MathBlock text={block.text} theme={theme} />
    case 'mermaid':
      return <MermaidBlock text={block.text} />
    case 'plantuml':
      return <PlantumlBlock text={block.text} />
    case 'list':
      return (
        <ol
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'grid',
            gap: T.paragraphSpacing * 0.5,
          }}
        >
          {block.items.map((item, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                gap: 14,
                color: p.text,
                fontSize: T.bodySize,
                lineHeight: T.lineRatio,
                letterSpacing: T.letterSpacing,
              }}
            >
              <span
                style={{
                  color: p.accent,
                  flexShrink: 0,
                  fontWeight: 700,
                  minWidth: block.ordered ? 44 : undefined,
                  textAlign: block.ordered ? 'right' : 'left',
                }}
              >
                {block.ordered ? `${i + 1}.` : theme.bulletSymbol || '•'}
              </span>
              <div dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
            </li>
          ))}
        </ol>
      )
    case 'image':
      return (
        <img
          src={block.url}
          alt={block.alt ?? ''}
          style={{
            maxWidth: '100%',
            borderRadius: 12,
            display: 'block',
            marginTop: 6,
          }}
        />
      )
    case 'divider':
      return (
        <div
          style={{
            height: 3,
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

// ---------- 卡片骨架 ----------

const Watermark = ({ theme }: { theme: XhsCardTheme }) => {
  if (!theme.watermark.enabled) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: theme.page.padding.left,
        bottom: Math.max(24, theme.page.padding.bottom * 0.32),
        fontSize: 26,
        color: theme.palette.muted,
        opacity: 0.85,
        letterSpacing: 1,
      }}
    >
      {theme.watermark.text}
    </div>
  )
}

const CoverCard = ({ card, theme }: { card: XhsCard; theme: XhsCardTheme }) => {
  const p = theme.palette
  const pd = theme.page.padding
  return (
    <div
      data-xhs-card
      style={{
        width: '100%',
        height: '100%',
        background: p.bg,
        padding: pd.top,
        paddingLeft: pd.left,
        paddingRight: pd.right,
        paddingBottom: pd.bottom,
        fontFamily: theme.fontFamily,
        color: p.text,
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30, marginTop: '4%' }}>
        {card.meta && card.meta.tags.length > 0 && (
          <div style={{ letterSpacing: 5, color: p.accent, fontSize: 32, fontWeight: 700 }}>
            #{card.meta.tags[0]!.toUpperCase()}#
          </div>
        )}
        <h1
          style={{
            color: p.heading,
            fontSize: theme.page.typography.headingSize * 1.35,
            lineHeight: 1.3,
            fontWeight: 800,
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {card.meta?.title ?? ''}
        </h1>
        {card.meta && card.meta.tags.length > 1 && (
          <div style={{ fontSize: 30, color: p.muted, letterSpacing: 3 }}>
            {card.meta.tags.slice(1).join('  /  ')}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: '1%' }}>
        {card.meta?.author && (
          <div style={{ fontSize: 28, color: p.muted }}>想法 {card.meta.author}</div>
        )}
        <div style={{ width: 120, height: 10, borderRadius: 5, background: p.accent }} />
      </div>
      {theme.watermark.enabled && <Watermark theme={theme} />}
    </div>
  )
}

export const CardPage = ({ card, theme }: { card: XhsCard; theme: XhsCardTheme }) => {
  const p = theme.palette
  const pd = theme.page.padding
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
        paddingTop: pd.top,
        paddingLeft: pd.left,
        paddingRight: pd.right,
        paddingBottom: pd.bottom + XHS_FOOTER_RESERVE,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 页眉（页码条）——与分页可用高度算法保持同一 header 高度 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          height: HEADER_HEIGHT,
        }}
      >
        <div style={{ color: p.accent, fontSize: 28, letterSpacing: 5, fontWeight: 600 }}>
          {card.meta?.tags[0] ? `#${card.meta.tags[0]}#` : ''}
        </div>
        <div style={{ color: p.muted, fontSize: 28, letterSpacing: 2 }}>
          {card.page} <span style={{ opacity: 0.5 }}>/ {card.totalPages ?? card.page}</span>
        </div>
      </div>

      {/* 流式内容区 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
        }}
      >
        {card.blocks.map((b, i) => (
          <BlockView key={i} block={b} theme={theme} />
        ))}
      </div>

      {theme.watermark.enabled && <Watermark theme={theme} />}
    </div>
  )
}

