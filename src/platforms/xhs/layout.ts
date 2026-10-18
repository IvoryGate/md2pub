import type { Block, Document } from '../../core/document/types'
import type { XhsCardSizeName } from './theme'
import { XHS_CARD_SIZES } from './theme'

/**
 * 小红书分页模型（流式分页，类比 LaTeX / Word）：
 * - 无手动分隔符；`---` 现在就是 markdown 原生 hr（divider）；
 * - 显式分页 = `<!-- pagebreak -->` / `<!-- newpage -->`（core 已解析为 pagebreak 块）；
 * - 自动分页 = 根据每个块在当前板式（页边距/行距/字号）下的实测高度做贪心装箱；
 * - 输出封面（首段 h1/h2 独立成卡）+ 正文卡片序列。
 */

export interface XhsCard {
  kind: 'cover' | 'content'
  /** 正文页码（封面为 0） */
  page: number
  totalPages?: number
  meta?: Document['meta']
  blocks: Block[]
}

export interface XhsLayoutContext {
  cover: 'auto' | 'off'
  size: XhsCardSizeName
}

/** { 卡片序列, 板式尺寸, 排版警告 } */
export interface XhsCardSet {
  cards: XhsCard[]
  size: { width: number; height: number }
  /** 测高分页产生的警告（例如单块超出整页高度） */
  warnings: string[]
}

export interface FlowMetrics {
  availableHeight: number
  /** 块间距（paragraphSpacing） */
  blockGap: number
}

/**
 * 与「测量」分离：measure.ts 负责给出每个块的实测高度（含 image/mermaid/katex 的影响），
 * 本函数纯逻辑贪心装箱。
 */
export function paginate(doc: Document, cards: Array<{ height: number }>, metrics: FlowMetrics): {
  pages: Block[][]
  warnings: string[]
} {
  const pages: Block[][] = []
  const warnings: string[] = []
  let current: Block[] = []
  let used = 0

  for (let i = 0; i < doc.blocks.length; i++) {
    const block = doc.blocks[i]!
    const height = cards[i]?.height ?? 0

    if (block.type === 'pagebreak') {
      if (current.length > 0) pages.push(current)
      current = []
      used = 0
      continue
    }

    const withGap = current.length > 0 ? metrics.blockGap : 0
    if (height > metrics.availableHeight) {
      // 单块高度超过整页可用高度：独占一页，并告警
      if (current.length > 0) {
        pages.push(current)
        current = []
        used = 0
      }
      if (used + height > metrics.availableHeight) {
        warnings.push(`第 ${i + 1} 块（${block.type}）高度超出卡片可用区域，单独成页仍会被裁切，请减字号/页边距或拆分内容。`)
        pages.push([block])
        continue
      }
    }

    if (used + withGap + height > metrics.availableHeight && current.length > 0) {
      pages.push(current)
      current = [block]
      used = height
    } else {
      current.push(block)
      used += withGap + height
    }
  }

  if (current.length > 0) pages.push(current)
  if (pages.length === 0) pages.push([])
  return { pages, warnings }
}

/** 把分页结果的正文的 blocks 序列组装成卡片（封面+正文），输出卡片集合 */
export function assembleCards(
  doc: Document,
  ctx: XhsLayoutContext,
  _size: { width: number; height: number },
  pages: Block[][],
  warnings: string[],
): XhsCardSet {
  const cards: XhsCard[] = []
  if (ctx.cover === 'auto') {
    cards.push({ kind: 'cover', page: 0, meta: doc.meta, blocks: [] })
  }
  pages.forEach((blocks, i) => {
    cards.push({ kind: 'content', page: i + 1, totalPages: pages.length, meta: doc.meta, blocks })
  })
  return { cards, warnings, size: XHS_CARD_SIZES[ctx.size] }
}
