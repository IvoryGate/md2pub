import type { Block, Document } from '../../core/document/types'
import type { XhsCardSizeName } from './theme'
import { XHS_CARD_SIZES } from './theme'

/**
 * 小红书分页模型（LaTeX 式流式分页）：
 * - 页是「线性排版容器」：段落填不满一页时按行拆分，下一页续排，不做整块搬运；
 * - 孤寡控制：段首至少 2 行（orphan）、段尾至少 2 行（widow），不足则整块下移；
 * - keep-with-next：标题/（以「：」结尾的）引导句后必须跟内容，页尾不孤行；
 * - 可拆块：段落（按行）、列表（按条目）；
 *   不可拆块：标题 / 代码 / 公式 / mermaid / 图 / 表格 / 引用（引用通常很短）；
 * - 显式分页 = `<!-- pagebreak -->`（core 解析为 pagebreak 块）。
 */

// ---------- 分页计划（纯逻辑，DOM 无关） ----------

/** 分页计划中的一个渲染单元 */
export type FlowUnit =
  | { kind: 'block'; index: number }
  /** 段落行区间 [fromLine, toLine)（0 基；行数 = 预估行盒高计算） */
  | { kind: 'text'; index: number; fromLine: number; toLine: number; cont: boolean }
  /** 列表条目区间 [fromItem, toItem)（0 基） */
  | { kind: 'list'; index: number; fromItem: number; toItem: number; cont: boolean }

/** 度量层对每块的测量输出 */
export interface BlockMeasures {
  /** 块总高（含自身外边距） */
  height: number
  /** 块自身段前距（标题/分隔线/图片）：块落在页首时会被丢弃（渲染层 start 同源），不占内容区 */
  topMargin?: number
  /** 文本块行盒高（= fontSize × lineHeight），只有可拆段落需要 */
  lineHeight?: number
  /** 列表各条目高度（含条目间 itemGap 需另给） */
  items?: number[]
  itemGap?: number
}

export interface FlowMetrics {
  availableHeight: number
  /** 块间统一间距（paragraphSpacing），与卡片渲染容器 gap 同源 */
  blockGap: number
}

/** 卡片里的块：原块 / 列表切片（纯逻辑可复现）/ 段落 HTML 切片（DOM 捕获） */
export type XhsCardBlock =
  | Block
  | { type: 'listSlice'; block: Extract<Block, { type: 'list' }>; from: number; to: number }
  | { type: 'paraSplit'; html: string }

export interface XhsCard {
  kind: 'cover' | 'content'
  /** 正文页码（封面为 0） */
  page: number
  totalPages?: number
  meta?: Document['meta']
  blocks: XhsCardBlock[]
}

export interface XhsLayoutContext {
  cover: 'auto' | 'off'
  size: XhsCardSizeName
}

/** { 卡片序列, 板式尺寸, 排版警告 } */
export interface XhsCardSet {
  cards: XhsCard[]
  size: { width: number; height: number }
  /** 排版警告（例如单块超出整页高度） */
  warnings: string[]
}

// ---------- LaTeX 式贪心流式分页 ----------

const ORPHAN_LINES = 2
const WIDOW_LINES = 2

const isKeepWithNext = (b: Block): boolean =>
  b.type === 'heading' || (b.type === 'paragraph' && /：\s*$/.test(b.text))

export function paginateFlow(
  blocks: Block[],
  m: BlockMeasures[],
  metrics: FlowMetrics,
): { pages: FlowUnit[][]; warnings: string[] } {
  const { availableHeight, blockGap } = metrics
  const pages: FlowUnit[][] = []
  const warnings: string[] = []
  let page: FlowUnit[] = []
  /** 与 page 对齐的单元高度（0 间距计入 gap） */
  let unitHeights: number[] = []
  const gapNow = () => (page.length > 0 ? blockGap : 0)
  const usedNow = () => unitHeights.reduce((s, h) => s + h, 0)
  const room = () => availableHeight - usedNow() - gapNow()

  const flush = () => {
    if (page.length > 0) pages.push(page)
    page = []
    unitHeights = []
  }
  const place = (u: FlowUnit, h: number) => {
    if (page.length > 0) unitHeights.push(blockGap)
    page.push(u)
    unitHeights.push(h)
  }
  /** 关页以迎接一个放不下的单元；标题/引导句不孤行页尾（keep-with-next 随行） */
  const closeForMove = () => {
    while (page.length > 1 && page[page.length - 1]!.kind === 'block') {
      const last = page[page.length - 1] as Extract<FlowUnit, { kind: 'block' }>
      if (!isKeepWithNext(blocks[last.index]!)) break
      page.pop()
      unitHeights.pop()
      unitHeights.pop() // 该单元的 gap
    }
    flush()
  }

  /** 段落填页：[from, total) 行区间从当前页尾部续排 */
  const fillText = (index: number, from: number, total: number, cont: boolean) => {
    const lh = m[index]!.lineHeight ?? 0
    const rest = total - from
    if (rest <= 0) return
    const space = room()
    if (rest * lh <= space) {
      // 完整段：占高用实测高度（比 行数×行高 更准）
      const totalH = m[index]!.height
      const totalLines = Math.max(1, Math.round(totalH / lh))
      place({ kind: 'text', index, fromLine: from, toLine: total, cont }, (totalH * rest) / totalLines)
      return
    }
    // 本页放不下：算能容纳的行数
    let k = Math.floor(space / lh)
    if (page.length > 0 && k < ORPHAN_LINES) {
      closeForMove()
      return fillText(index, from, total, false)
    }
    if (page.length > 0 && rest - k < WIDOW_LINES) {
      closeForMove()
      return fillText(index, from, total, false)
    }
    // 页空（段首或续排）：孤寡惩罚豁免，尽量铺满整页（超长段落跨多页）
    k = Math.max(1, Math.min(k, Math.floor(availableHeight / lh)))
    place({ kind: 'text', index, fromLine: from, toLine: from + k, cont }, k * lh)
    flush()
    fillText(index, from + k, total, true)
  }

  /** 列表填页：条目为拆分单元，条目间另有 itemGap */
  const fillList = (index: number, from: number, cont: boolean) => {
    const items = m[index]!.items ?? []
    const ig = m[index]!.itemGap ?? 0
    const n = items.length
    if (from >= n) return
    const spanH = (from: number, to: number) => {
      // items[from, to) 高度 + 条目间 gap
      let s = items.slice(from, to).reduce((a, b) => a + b, 0)
      if (to > from + 1) s += (to - from - 1) * ig
      return s
    }
    const space = room()
    let fit = from
    while (fit < n && spanH(from, fit + 1) <= space) fit++

    if (fit === n) {
      place({ kind: 'list', index, fromItem: from, toItem: n, cont }, spanH(from, n))
      return
    }
    // 空间连一个条目都放不下：关页整搬（列表条目视觉独立， LaTeX 也按条目跨页，
    // 不做比段落更严的「页尾留 2 条」纪律——那会让三项列表整块下移 leaving 大片空白）
    if (page.length > 0 && fit === from) {
      closeForMove()
      return fillList(index, from, cont)
    }
    // 页空：铺满整页再续排
    if (page.length === 0) {
      fit = from
      const full = availableHeight
      while (fit < n && spanH(from, fit + 1) <= full) fit++
      fit = Math.max(from + 1, fit)
    }
    place({ kind: 'list', index, fromItem: from, toItem: fit, cont }, spanH(from, fit))
    flush()
    fillList(index, fit, true)
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!
    const md = m[i]!
    if (block.type === 'pagebreak') {
      flush()
      continue
    }
    if (block.type === 'paragraph') {
      const lines = Math.max(1, Math.round(md.height / (md.lineHeight ?? 1)))
      fillText(i, 0, lines, false)
      continue
    }
    if (block.type === 'list' && md.items && md.items.length > 0) {
      fillList(i, 0, false)
      continue
    }
    // 原子块：落在页首时丢掉自身段前距（渲染层 start 同源）
    if (md.height > availableHeight) {
      flush()
      warnings.push(
        `第 ${i + 1} 块（${block.type}）高度超出卡片可用区域，单独成页仍会被裁切，请减字号/页边距或拆分内容。`,
      )
      place({ kind: 'block', index: i }, md.height - (md.topMargin ?? 0))
      flush()
      continue
    }
    if (usedNow() + gapNow() + md.height - (page.length === 0 ? (md.topMargin ?? 0) : 0) > availableHeight) {
      closeForMove()
    }
    place({ kind: 'block', index: i }, md.height - (page.length === 0 ? (md.topMargin ?? 0) : 0))
  }
  flush()

  if (pages.length === 0) pages.push([])
  return { pages, warnings }
}

/** 把分页计划组装成卡片（封面 + 正文），输出卡片集合（split 单元由度量层解析后传入） */
export function assembleCards(
  doc: Document,
  ctx: XhsLayoutContext,
  cards: Array<{ blocks: XhsCardBlock[] }>,
  warnings: string[],
): XhsCardSet {
  const out: XhsCard[] = []
  if (ctx.cover === 'auto') {
    out.push({ kind: 'cover', page: 0, meta: doc.meta, blocks: [] })
  }
  cards.forEach((p, i) => {
    out.push({ kind: 'content', page: i + 1, totalPages: cards.length, meta: doc.meta, blocks: p.blocks })
  })
  return { cards: out, warnings, size: XHS_CARD_SIZES[ctx.size] }
}
