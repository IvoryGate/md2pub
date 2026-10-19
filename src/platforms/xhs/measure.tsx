import { useEffect, useRef } from 'react'
import type { Document } from '../../core/document/types'
import type { XhsCardSizeName, XhsCardTheme } from './theme'
import { XHS_CARD_SIZES, computeContentMetrics } from './theme'
import {
  assembleCards,
  paginateFlow,
  type BlockMeasures,
  type FlowUnit,
  type XhsCardBlock,
  type XhsCardSet,
} from './layout'
import { BlockView } from './CardPage'

/**
 * 度量与流式分页入口。
 * 原则：「测多高就占多高」——度量渲染器与卡片渲染严格同源（同一个 BlockView 同宽），
 * ResizeObserver 跟踪每块实际高度（图片/KaTeX/Mermaid 异步撑高后最终稳定）。
 * 本文件承担：采样 → paginateFlow（layout.ts 纯逻辑）→ 对拆分单元做 DOM Range 解析 → 组装卡片。
 */

const HIDDEN_STYLE: React.CSSProperties = {
  position: 'fixed',
  left: -100000,
  top: 0,
  visibility: 'hidden',
  pointerEvents: 'none',
  zIndex: -1,
}

interface MeasureLayerProps {
  doc: Document
  theme: XhsCardTheme
  sizeName: XhsCardSizeName
  cover: 'auto' | 'off'
  onCardSet: (set: XhsCardSet) => void
}

/** 隐藏的逐块渲染层，输出实测块度量并回调完整卡片集合 */
export const XhsMeasureLayer = ({ doc, theme, sizeName, cover, onCardSet }: MeasureLayerProps) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const onCardSetRef = useRef(onCardSet)
  onCardSetRef.current = onCardSet

  const contentWidth = computeContentMetrics(XHS_CARD_SIZES[sizeName], theme).contentWidth
  const visibleCount = doc.blocks.filter(b => b.type !== 'pagebreak').length

  const measure = () => {
    const root = rootRef.current
    if (!root) return
    // allWrappers 与 doc.blocks 一一对应（pagebreak 占位 div 有 data-skip-meas）
    const allWrappers = Array.from(root.children) as HTMLElement[]
    if (allWrappers.length !== doc.blocks.length) return // 渲染尚未同步
    const wrapperOf: (HTMLElement | undefined)[] = doc.blocks.map((b, i) =>
      b.type === 'pagebreak' ? undefined : allWrappers[i],
    )
    if (wrapperOf.filter(Boolean).length !== visibleCount) return

    // ---------- 采样 ----------
    const B = theme.layout.body
    const paraLineHeight = B.size * B.lineRatio
    const measures: Record<number, BlockMeasures> = {}
    doc.blocks.forEach((block, i) => {
      if (block.type === 'pagebreak') return
      const w = wrapperOf[i]!
      const cs = window.getComputedStyle(w)
      const rect = w.getBoundingClientRect()
      const vertical = parseFloat(cs.marginTop || '0') + parseFloat(cs.marginBottom || '0')
      const entry: BlockMeasures = { height: rect.height + vertical }
      if (block.type === 'paragraph') entry.lineHeight = paraLineHeight
      if (block.type === 'list') {
        const container = w.querySelector<HTMLElement>('[data-list]')
        if (container) {
          entry.items = Array.from(container.children).map(
            li => (li as HTMLElement).getBoundingClientRect().height,
          )
          entry.itemGap = parseFloat(window.getComputedStyle(container).rowGap || '0')
        }
      }
      measures[i] = entry
    })

    // ---------- 分页（layout.ts 纯逻辑） ----------
    const dims = XHS_CARD_SIZES[sizeName]
    const { availableHeight } = computeContentMetrics(dims, theme)
    // 封面已展示 doc 标题（meta.title 即首个 heading 文本），正文不重复渲染该块
    const skipTitle = cover === 'auto' && doc.blocks[0]?.type === 'heading'
    const offset = skipTitle ? 1 : 0
    const bodyBlocks = doc.blocks.slice(offset)
    const m: BlockMeasures[] = bodyBlocks.map((_, k) => measures[offset + k] ?? { height: 0 })
    const { pages, warnings } = paginateFlow(bodyBlocks, m, {
      availableHeight,
      blockGap: theme.layout.body.paragraphSpacing,
    })

    // ---------- 拆分单元解析 ----------
    const lineCount = (docIndex: number): number => {
      const entry = measures[docIndex]!
      return Math.max(1, Math.round(entry.height / (entry.lineHeight ?? 1)))
    }
    const extract = (u: FlowUnit): XhsCardBlock => {
      if (u.kind === 'block') return bodyBlocks[u.index]!
      if (u.kind === 'list') {
        const listing = bodyBlocks[u.index]!
        if (listing.type !== 'list') return listing
        if (u.fromItem === 0 && u.toItem >= listing.items.length) return listing
        return { type: 'listSlice', block: listing, from: u.fromItem, to: u.toItem }
      }
      // text：从活 DOM 捕获行区间；整段回源
      const full = lineCount(offset + u.index)
      if (u.fromLine === 0 && u.toLine >= full) return bodyBlocks[u.index]!
      const wrap = wrapperOf[offset + u.index]!
      const para = (wrap.firstElementChild as HTMLElement) ?? wrap
      const html = extractLines(para, u.fromLine, u.toLine, measures[offset + u.index]!.lineHeight ?? paraLineHeight)
      return { type: 'paraSplit', html }
    }
    const cards = pages.map(p => ({
      blocks: p.map(u => extract(u)),
    }))
    const cardSet = assembleCards(doc, { cover, size: sizeName }, cards, warnings)

    // ---------- 回调（计划签名去重，避免父级无谓刷新） ----------
    const sig = pages
      .map(p =>
        p
          .map(u =>
            u.kind === 'block'
              ? `b${u.index}`
              : u.kind === 'text'
                ? `t${u.index}[${u.fromLine},${u.toLine}]`
                : `l${u.index}[${u.fromItem},${u.toItem}]`,
          )
          .join('|'),
      )
      .join(';')
    if (sig === root.dataset.sig) return
    root.dataset.sig = sig
    onCardSetRef.current(cardSet)
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    // 初测 + 异步内容（图片 / KaTeX 字体 / Mermaid SVG）改变高度后的跟踪
    measure()
    const ro = new ResizeObserver(() => measure())
    Array.from(root.children).forEach(w => ro.observe(w))
    if (document.fonts?.status === 'loading') document.fonts.ready.then(measure).catch(() => {})
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, theme, sizeName, cover])

  return (
    <div
      ref={rootRef}
      style={{ ...HIDDEN_STYLE, fontFamily: theme.fontFamily, color: theme.palette.text }}
    >
      {doc.blocks.map((block, i) => {
        if (block.type === 'pagebreak')
          return <div key={i} data-skip-meas="1" style={{ height: 0, width: contentWidth }} />
        return (
          <div key={i} style={{ width: contentWidth }}>
            <BlockView block={block} theme={theme} />
          </div>
        )
      })}
    </div>
  )
}

/**
 * 从段落 DOM 捕获行区间 [fromLine0, toLine0)（0 基）的 HTML。
 * 用文本节点累积字符 + 二分「前缀占用行数」，在真实折行处（而非字符猜测）切开：
 * - 行盒判定用 Range bounding rect，行高完全来自实际渲染；
 * - cloneContents 生成均衡文档碎片，行内 span/KaTeX 结构自动保留；
 * - 行内原子（KaTeX 等）跨断点时整体归下一半（等价不可断原子）。
 */
const extractLines = (container: HTMLElement, fromLine0: number, toLine0: number, lineHeight: number): string => {
  if (fromLine0 >= toLine0) return ''
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let n: Node | null = null
  while ((n = walker.nextNode())) nodes.push(n as Text)
  if (nodes.length === 0 || lineHeight <= 0) return container.innerHTML

  const totalChars = nodes.reduce((s, t) => s + t.data.length, 0)
  /** 覆盖 [0, gCount) 个字符的 Range 终点（节点, 字符偏移） */
  const prefixEnd = (gCount: number): [Text, number] => {
    let g = Math.max(0, gCount)
    for (const t of nodes) {
      const len = t.data.length
      if (g <= len) return [t, g]
      g -= len
    }
    const last = nodes[nodes.length - 1]!
    return [last, last.data.length]
  }
  /** 前缀 gCount 字符占用的行数（bbox 高 / 行盒高） */
  const linesOf = (gCount: number): number => {
    if (gCount <= 0) return 0
    const [tn, off] = prefixEnd(gCount)
    const r = document.createRange()
    r.setStart(nodes[0]!, 0)
    r.setEnd(tn, off)
    const rect = r.getBoundingClientRect()
    if (rect.height <= 0) return 0
    return Math.max(1, Math.round(rect.height / lineHeight - 0.02))
  }
  /** 「前缀行数 ≤ cap」的最大字符数（cap 不变 → 二分单调） */
  const lineEdge = (cap: number): number => {
    let lo = 0
    let hi = totalChars
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (linesOf(mid) <= cap) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  const startG = fromLine0 > 0 ? lineEdge(fromLine0) : 0 // 行 0 基 J 的起点 = 前缀行数 ≤ J 的边界
  const ge = lineEdge(toLine0) ?? 0
  if (ge <= startG) return fromLine0 === 0 ? container.innerHTML : ''
  const r = document.createRange()
  if (startG > 0) {
    const [sn, so] = prefixEnd(startG)
    r.setStart(sn, so)
  } else {
    r.setStart(nodes[0]!, 0)
  }
  const [en, eo] = prefixEnd(ge)
  r.setEnd(en, eo)
  const frag = r.cloneContents()
  const div = document.createElement('div')
  div.append(frag)
  return div.innerHTML
}
