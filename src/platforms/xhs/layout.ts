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
 *
 * keep-with-next（分页约束，调研自长文图设计规范）：
 * - 标题不得孤行页尾——页放不下时把结尾的「标题/引导句/引用」链一并带到下页
 * - 以「：」结尾的段落语义上引出下一块，与下一块绑定
 */
const isKeepWithNext = (b?: Block): boolean =>
  !!b &&
  (b.type === 'heading' ||
    b.type === 'quote' ||
    (b.type === 'paragraph' && /：\s*$/.test(b.text)))

export function paginate(doc: Document, cards: Array<{ height: number }>, metrics: FlowMetrics): {
  pages: Block[][]
  warnings: string[]
} {
  const { availableHeight, blockGap } = metrics
  const pages: Block[][] = []
  const warnings: string[] = []
  let current: Block[] = []
  /** 与 current 对齐的块高（关页/下移标题时重算页占用） */
  let curHeights: number[] = []
  const pageUsed = () =>
    curHeights.reduce((s, h) => s + h, 0) + (current.length > 1 ? (current.length - 1) * blockGap : 0)
  const flush = () => {
    if (current.length > 0) pages.push(current)
    current = []
    curHeights = []
  }

  for (let i = 0; i < doc.blocks.length; i++) {
    const block = doc.blocks[i]!
    const height = cards[i]?.height ?? 0

    if (block.type === 'pagebreak') {
      flush()
      continue
    }

    // 单块高度超过整页可用高度：独占一页，并告警
    if (height > availableHeight) {
      flush()
      warnings.push(
        `第 ${i + 1} 块（${block.type}）高度超出卡片可用区域，单独成页仍会被裁切，请减字号/页边距或拆分内容。`,
      )
      pages.push([block])
      continue
    }

    // 放不下 → 关页；先把结尾的 keep-with-next 链剥下来随本块去下页（标题不孤行）
    if (current.length > 0 && pageUsed() + height + blockGap > availableHeight) {
      while (current.length > 1 && isKeepWithNext(current[current.length - 1])) {
        current.pop()
        curHeights.pop()
      }
      flush()
    }

    current.push(block)
    curHeights.push(height)
  }
  flush()

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
