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
  | { type: 'listSlice'; block: Extract<Block, { type: 'list' }>; from: number; to: number; line?: number }
  | { type: 'paraSplit'; lines: string[]; line?: number }

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

// ---------- 全局最优分页（DP） ----------

/**
 * 分页从「贪心 + 局部规则」升级为全篇 DP：
 *
 *   目标 = Σ 各页留白²（以行高归一） + 孤行/寡行代价
 *
 * 贪心时代每改一条局部规则都会让后续页洗牌（实测某页 89%→95% 的同时
 * 另一页 96%→91%），无法宣称整体最优。DP 一次求解全篇断点，
 * 每页的取舍都在全局账本里算过——留白被均匀分摊，孤行/寡行只在
 * 「全局收益更划算」时发生，而不是被一条硬规则一刀切。
 *
 * 硬约束（不可谈判）：
 * - 表格/代码/图/公式/引用不可拆（完整性）
 * - 标题与「：」引导句不悬页尾（keep-with-next）
 * - 显式 `<!-- pagebreak -->` 强制断页
 */
const ORPHAN_DEMERIT = 0.6
/** 页首残句（寡行）比页尾孤行醒目得多：两三个字的段尾碎片独占页首，观感近似错误。
    权重必须大到 DP 宁可让本页少一行也不接受——这是「视觉代价进入全局账本」。 */
const WIDOW_DEMERIT = 8.0
/** 「：」引导句断在页尾：轻微观感损失，软代价；
    若改用硬约束会逼出更丑的页首残句（本页明明放得下却整行推走） */
const LEADIN_DEMERIT = 2.0
/** 单块超过整页时的兜底代价（仍然单独成页并给出警告） */
const OVERSIZE_PENALTY = 1e3

const isKeepWithNext = (b: Block): boolean =>
  b.type === 'heading' || (b.type === 'paragraph' && /：\s*$/.test(b.text))

type Atom =
  | { kind: 'block'; block: number; h: number; topMargin: number; keepAfter: boolean; forceBreak: boolean }
  | { kind: 'line'; block: number; line: number; lines: number; h: number; leadIn: boolean; forceBreak: boolean }
  | { kind: 'item'; block: number; item: number; items: number; h: number; itemGap: number; forceBreak: boolean }

export function paginateFlow(
  blocks: Block[],
  m: BlockMeasures[],
  metrics: FlowMetrics,
  /** 分页策略：optimal = 全篇 DP 最优；greedy = 顺序填满（首适应） */
  mode: 'optimal' | 'greedy' = 'optimal',
): { pages: FlowUnit[][]; warnings: string[] } {
  const { availableHeight, blockGap } = metrics
  const warnings: string[] = []

  // ---------- 原子化：段落→行原子、列表→条目原子、其余→整块原子 ----------
  const atoms: Atom[] = []
  const markBreak = () => {
    const last = atoms[atoms.length - 1]
    if (last) last.forceBreak = true
  }
  blocks.forEach((b, i) => {
    if (b.type === 'pagebreak') {
      markBreak()
      return
    }
    const md = m[i]
    if (!md) return
    if (b.type === 'paragraph') {
      const lines = Math.max(1, Math.round(md.height / (md.lineHeight ?? 1)))
      const h = md.height / lines
      // 「：」引导句不再是硬约束，仅作为页尾软代价（见 LEADIN_DEMERIT 注释）
      const leadIn = isKeepWithNext(b)
      for (let l = 0; l < lines; l++)
        atoms.push({ kind: 'line', block: i, line: l, lines, h, leadIn: leadIn && l === lines - 1, forceBreak: false })
      return
    }
    if (b.type === 'list' && md.items && md.items.length > 0) {
      md.items.forEach((h, k) =>
        atoms.push({ kind: 'item', block: i, item: k, items: md.items!.length, h, itemGap: md.itemGap ?? 0, forceBreak: false }),
      )
      return
    }
    if (md.height > availableHeight) {
      warnings.push(
        `第 ${i + 1} 块（${b.type}）高度超出卡片可用区域，单独成页仍会被裁切，请减字号/页边距或拆分内容。`,
      )
    }
    atoms.push({
      kind: 'block',
      block: i,
      h: md.height,
      topMargin: md.topMargin ?? 0,
      keepAfter: isKeepWithNext(b),
      forceBreak: false,
    })
  })

  const N = atoms.length
  if (N === 0) return { pages: [[]], warnings }

  // 行高归一基准（留白代价以「行」为单位，避免不同字号下权重漂移）
  const lh =
    (m.find(x => x.lineHeight && x.lineHeight > 0)?.lineHeight) ??
    Math.max(1, Math.round(availableHeight / 20))
  const shortfallCost = (used: number) => {
    const s = Math.max(0, availableHeight - used) / lh
    return s * s
  }

  // ---------- DP：best[a] = 从第 a 个原子开始排版的最小全篇代价 ----------
  const INF = Number.POSITIVE_INFINITY
  const best = new Float64Array(N + 1).fill(INF)
  const next = new Int32Array(N + 1).fill(-1)
  best[N] = 0

  for (let a = N - 1; a >= 0; a--) {
    let used = 0
    let prevBlock = -1
    for (let b = a; b < N; b++) {
      const atom = atoms[b]!
      const sameBlock = atom.block === prevBlock
      const gap = b === a ? 0 : sameBlock ? (atom.kind === 'item' ? atom.itemGap : 0) : blockGap
      const h = atom.h - (b === a && atom.kind === 'block' ? atom.topMargin : 0)
      const candidate = used + gap + h
      const aloneOverflow = b === a && candidate > availableHeight + 0.5
      if (candidate > availableHeight + 0.5 && !aloneOverflow) break
      used += gap + h
      prevBlock = atom.block

      const e = b + 1
      const atDocEnd = e >= N
      // 标题是硬 keep-with-next（页尾悬标题不可接受）；「：」引导句走软代价
      if (!atDocEnd && atom.kind === 'block' && atom.keepAfter) continue

      // 页尾孤行 / 下页寡行 / 引导句悬尾（软代价，交给全局权衡）
      let extra = 0
      let orphan = false
      let widow = false
      if (!atDocEnd && atom.kind === 'line' && atoms[e]!.kind === 'line' && atoms[e]!.block === atom.block) {
        let placed = 0
        for (let k = b; k >= a && atoms[k]!.kind === 'line' && atoms[k]!.block === atom.block; k--) placed++
        orphan = placed === 1
        widow = atom.lines - (atoms[e] as Extract<Atom, { kind: 'line' }>).line === 1
      }
      if (orphan) extra += ORPHAN_DEMERIT
      if (widow) extra += WIDOW_DEMERIT
      if (!atDocEnd && atom.kind === 'line' && atom.leadIn) extra += LEADIN_DEMERIT
      if (aloneOverflow) extra += OVERSIZE_PENALTY

      const cost = atDocEnd ? extra : shortfallCost(used) + extra + best[e]!
      if (cost < best[a]!) {
        best[a] = cost
        next[a] = e
      }
      if (atom.forceBreak) break // 显式分页：本页到此为止
      if (atDocEnd) break
    }
  }

  // ---------- 原子区间 → FlowUnit ----------
  const buildUnits = (a: number, e: number): FlowUnit[] => {
    const units: FlowUnit[] = []
    for (let k = a; k < e; ) {
      const at = atoms[k]!
      if (at.kind === 'block') {
        units.push({ kind: 'block', index: at.block })
        k++
        continue
      }
      if (at.kind === 'line') {
        const from = at.line
        let to = from + 1
        k++
        while (k < e) {
          const nx = atoms[k]!
          if (nx.kind !== 'line' || nx.block !== at.block || nx.line !== to) break
          to++
          k++
        }
        units.push({ kind: 'text', index: at.block, fromLine: from, toLine: to, cont: from > 0 })
        continue
      }
      const from = at.item
      let to = from + 1
      k++
      while (k < e) {
        const nx = atoms[k]!
        if (nx.kind !== 'item' || nx.block !== at.block || nx.item !== to) break
        to++
        k++
      }
      units.push({ kind: 'list', index: at.block, fromItem: from, toItem: to, cont: from > 0 })
    }
    return units
  }

  const pages: FlowUnit[][] = []

  if (mode === 'greedy') {
    // 顺序填页（首适应）：放不下就换页；页尾不留标题/引导块
    let start = 0
    let used = 0
    let prevBlock = -1
    const flushAt = (endAtom: number) => {
      const u = buildUnits(start, endAtom)
      if (u.length) pages.push(u)
      start = endAtom
      used = 0
      prevBlock = -1
    }
    for (let b = 0; b < N; b++) {
      const atom = atoms[b]!
      const gap = b === start ? 0 : atom.block === prevBlock ? (atom.kind === 'item' ? atom.itemGap : 0) : blockGap
      const h = atom.h - (b === start && atom.kind === 'block' ? atom.topMargin : 0)
      if (b > start && used + gap + h > availableHeight + 0.5) {
        let end = b
        while (end > start + 1) {
          const last = atoms[end - 1]!
          if (last.kind === 'block' && last.keepAfter) end--
          else break
        }
        flushAt(end)
        b = end - 1
        continue
      }
      used += gap + h
      prevBlock = atom.block
      if (atom.forceBreak) flushAt(b + 1)
    }
    if (start < N) flushAt(N)
  } else {
    let a = 0
    while (a < N) {
      const e = next[a]!
      if (e <= a) break
      const units = buildUnits(a, e)
      if (units.length) pages.push(units)
      a = e
    }
  }
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
