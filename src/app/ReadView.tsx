import { useEffect, useMemo, useRef } from 'react'
import { parseDocument, renderInline } from '../core/document/parse'
import type { Block } from '../core/document/types'
import { renderMathHtml, useDiagramSvg } from '../platforms/shared-blocks'
import { bindSyncScroll, type ScrollBus } from './scrollSync'

/**
 * 编辑器「阅读模式」：同一文档的不可编辑完整渲染（Obsidian 阅读视图对位）。
 * - 全部块级渲染：公式/Mermaid/PlantUML/表格/图片一应俱全
 * - 视觉为紧凑文档风（非小红书卡片风），与卡片轨道（发布预览）各司其职
 * - 滚动经同一 bus 上报 'editor' 侧，与卡片轨道保持双向同步
 */
export const ReadView = ({
  markdown,
  bus,
}: {
  markdown: string
  bus: ScrollBus
}) => {
  const doc = useMemo(() => parseDocument(markdown), [markdown])
  const scrollRef = useRef<HTMLDivElement | null>(null)
  // 正文里有 H1 时，front-matter 标题不重复展示
  const docTitle = doc.blocks.some((b) => b.type === 'heading' && b.level === 1)
    ? null
    : doc.meta.title

  // 阅读视图滚动 = 'editor' 侧（顶替编辑器与卡片轨道同步）
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    return bindSyncScroll(el, 'editor', bus)
  }, [bus])

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div ref={scrollRef} className="h-full overflow-y-auto px-6 pb-10 pt-1">
        {/* 文档标题（来自 front-matter，正文无 H1 时才显示） */}
        {docTitle ? (
          <div className="relative mb-5 mt-3">
            <h1 className="text-center text-[21px] font-extrabold leading-snug tracking-[0.01em] text-[#1d1d1f]">
              {docTitle}
            </h1>
            <div className="mx-auto mt-2 h-[3px] w-10 rounded-full bg-[#ff2442]/70" />
          </div>
        ) : null}

        {doc.blocks.map((b, i) => (
          <ReadBlockView key={i} block={b} />
        ))}
      </div>
    </div>
  )
}

// ---------- 块渲染（紧凑文档风） ----------

const DiagramView = ({ kind, text }: { kind: 'mermaid' | 'plantuml'; text: string }) => {
  const { svg, error } = useDiagramSvg(kind, text)
  if (error)
    return (
      <div className="my-3 rounded-lg border border-[#c0564e]/30 bg-[#c0564e]/[0.05] px-3 py-2 font-mono text-[11px] leading-relaxed text-[#c0564e]">
        {kind === 'mermaid' ? 'Mermaid' : 'PlantUML'} 渲染失败：{error}
      </div>
    )
  if (!svg)
    return (
      <pre className="read-code my-3 text-ink-faint">
        {text}
      </pre>
    )
  return (
    <div
      className="my-3 flex justify-center [&>svg]:h-auto [&>svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

const MathReadBlock = ({ text }: { text: string }) => {
  const html = useMemo(() => renderMathHtml(text), [text])
  return (
    <div
      className="read-math my-3 overflow-x-auto text-center text-[15px] text-[#1d1d1f]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

const HEADING_STYLES = [
  { size: 21, mt: 18 },
  { size: 17.5, mt: 14 },
  { size: 15, mt: 11 },
  { size: 14, mt: 9 },
]

const ReadBlockView = ({ block }: { block: Block }) => {
  switch (block.type) {
    case 'heading': {
      const s = HEADING_STYLES[block.level - 1]!
      return (
        <div
          className="font-bold text-[#1d1d1f]"
          style={{ fontSize: s.size, marginTop: s.mt, marginBottom: 5, lineHeight: 1.4 }}
        >
          {block.text}
        </div>
      )
    }
    case 'paragraph':
      return (
        <div
          className="my-2.5 text-[13.5px] leading-[1.78] text-[#1d1d1f]"
          dangerouslySetInnerHTML={{ __html: renderInline(block.text) }}
        />
      )
    case 'quote': {
      const html = block.text.split('\n').map((line) => renderInline(line)).join('<br/>')
      return (
        <blockquote
          className="my-3 rounded-r-lg border-l-[3px] border-[#ff2442]/60 bg-[#ff2442]/[0.04] py-2 pl-3.5 pr-2 text-[13px] italic leading-[1.7] text-ink-soft"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )
    }
    case 'code':
      return <pre className="read-code my-3">{block.text}</pre>
    case 'math':
      return <MathReadBlock text={block.text} />
    case 'mermaid':
      return <DiagramView kind="mermaid" text={block.text} />
    case 'plantuml':
      return <DiagramView kind="plantuml" text={block.text} />
    case 'list':
      return (
        <div className="my-2.5 flex flex-col gap-1.5">
          {block.items.map((item, i) => (
            <div key={i} className="flex gap-2 text-[13.5px] leading-[1.75] text-[#1d1d1f]">
              <span className="min-w-4 shrink-0 select-none text-ink-faint tabular-nums">
                {block.ordered ? `${i + 1}.` : '•'}
              </span>
              <div dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
            </div>
          ))}
        </div>
      )
    case 'table':
      return (
        <div className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-[12px] leading-relaxed">
            <thead>
              <tr>
                {block.head.map((h, i) => (
                  <th
                    key={i}
                    className="border-b border-black/10 bg-black/[0.03] px-3 py-2 text-left font-bold text-[#1d1d1f]"
                    dangerouslySetInnerHTML={{ __html: renderInline(h) }}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td
                      key={ci}
                      className="border-b border-black/[0.06] px-3 py-2 align-top text-[#1d1d1f]"
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
          className="my-3 max-w-full rounded-xl border border-black/5"
        />
      )
    case 'divider':
      return <hr className="my-4 border-0 border-t border-black/10" />
    case 'pagebreak':
      return (
        <div className="my-4 flex items-center gap-2 text-[10px] tracking-widest text-ink-faint">
          <div className="h-px flex-1 border-t border-dashed border-black/15" />
          分页
          <div className="h-px flex-1 border-t border-dashed border-black/15" />
        </div>
      )
  }
}
