import {
  ViewPlugin,
  Decoration,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from '@codemirror/view'
import { type Range } from '@codemirror/state'

const fenceRe = /^\s{0,3}(```|~~~)/
const headingRe = /^(#{1,6})(\s|$)/
const hrRe = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/
const inlineCodeRe = /`([^`\n]+)`/g

/** 栅栏行集合缓存（供行号覆盖层判定"标题倍率是否生效"复用） */
let fenceCache: { doc: unknown; lines: Set<number> } | null = null
export function fencedLines(doc: import('@codemirror/state').Text): Set<number> {
  if (fenceCache && fenceCache.doc === doc) return fenceCache.lines
  const set = new Set<number>()
  let inFence = false
  for (let i = 1; i <= doc.lines; i++) {
    const isFence = fenceRe.test(doc.line(i).text)
    if (inFence) {
      set.add(i)
      if (isFence) inFence = false
    } else if (isFence) {
      set.add(i)
      inFence = true
    }
  }
  fenceCache = { doc, lines: set }
  return set
}

/** 头部色带内 padding（index.css .cm-fence-head padding-top 同值，改需同步） */
export const FENCE_HEAD_PAD = 12

/** 行装饰：栅栏块整块化 + 标题/hr 的块间外边距（间距恒定、行号块内居中） */
/**
 * 围栏代码块「整块化」装饰（Phycat/Obsidian 式）：
 * - 围栏区每一行加线装饰，背景连续 → 视觉上是一个完整的色框
 * - 起始围栏行（```lang）加圆角与强调色，闭合围栏行补圆角
 * - 围栏外的行内 `code` 单独上 chip（不被整块样式吞掉）
 */
export const codeBlockStyler = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = build(view)
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = build(u.view)
    }
  },
  { decorations: (v) => v.decorations },
)

function build(view: EditorView): DecorationSet {
  const doc = view.state.doc
  const ranges: Array<Range<Decoration>> = []

  // 文档规模小（百行级），每次全文扫栅栏状态成本可忽略；
  // 早期返回没必要，Decoration.set 会自动处理排序与裁剪
  let inFence = false

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const isFence = fenceRe.test(line.text)

    if (inFence) {
      ranges.push(
        Decoration.line({ class: 'cm-block-code' }).range(line.from),
      )
      if (isFence) {
        // 闭合围栏：补底部圆角
        ranges.push(
          Decoration.line({ class: 'cm-block-code cm-fence-tail' }).range(line.from),
        )
        inFence = false
      }
      continue
    }

    if (isFence) {
      // 起始围栏：开新块，```lang 行强调；块上外边距（与上文拉开一点）
      ranges.push(
        Decoration.line({
          class: 'cm-block-code cm-fence-head cm-fence-line',
        }).range(line.from),
      )
      inFence = true
      continue
    }

    if (headingRe.test(line.text)) {
      const level = Math.min(6, (headingRe.exec(line.text)![1]!.length))
      ranges.push(
        Decoration.line({ class: `cm-h-line cm-h${level}` }).range(line.from),
      )
      continue
    }

    if (hrRe.test(line.text)) {
      ranges.push(
        Decoration.line({ class: 'cm-hr-line' }).range(line.from),
      )
      continue
    }

    // 围栏外：行内 code chip（单行内配对，避免跨行 mark）
    inlineCodeRe.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = inlineCodeRe.exec(line.text))) {
      ranges.push(
        Decoration.mark({ class: 'cm-inline-code' }).range(
          line.from + m.index,
          line.from + m.index + m[0].length,
        ),
      )
    }
  }

  // 未闭合围栏：末行补底部圆角
  if (inFence) {
    const last = doc.line(doc.lines)
    ranges.push(Decoration.line({ class: 'cm-fence-tail' }).range(last.from))
  }

  return Decoration.set(ranges, true)
}
