import {
  ViewPlugin,
  Decoration,
  WidgetType,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import katex from 'katex'

/** 行内公式 Widget：把 $...$ / $$...$$ 渲染成 KaTeX HTML */
class MathWidget extends WidgetType {
  constructor(
    readonly latex: string,
    readonly display: boolean,
  ) {
    super()
  }
  override eq(other: this): boolean {
    return other.latex === this.latex && other.display === this.display
  }
  override toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-md-math'
    try {
      span.innerHTML = katex.renderToString(this.latex, {
        displayMode: this.display,
        throwOnError: false,
        output: 'html',
      })
    } catch {
      span.textContent = this.latex
    }
    return span
  }
  override ignoreEvent(): boolean {
    return false
  }
}

interface Hit {
  from: number
  to: number
  latex: string
  display: boolean
  overlaps(other: Hit): boolean
}

/**
 * 伪公式过滤（Obsidian 同款启发式）：
 * - 定界符内侧不得紧跟空格（排除 "$ 3.41 元 … $" 的普通行文）
 * - 内容不含 CJK 字符（货币/正文混排场景公式基本无中文）
 * - 长度上限，防止跨長段误配对
 */
const isPlausibleMath = (s: string, display: boolean): boolean =>
  s.length > 0 &&
  s.length <= 200 &&
  !/[\u4e00-\u9fff]/.test(s) &&
  // 显示模式 $$…$$ 允许内侧空格；行内 $…$ 不允许（Obsidian 规则）
  (display || !/^\s|\s$/.test(s))

/** 行内公式扫描：先匹配 $$…$$，再叠加 $…$（丢弃重叠部分） */
function collect(view: EditorView): DecorationSet {
  const sel = view.state.selection.ranges
  const hits: Hit[] = []

  const overlapsSelection = (f: number, t: number) =>
    sel.some((r) => r.from < t && r.to > f)

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    const taken: Array<{ a: number; b: number }> = []

    // 注意：replace 装饰不允许跨换行，两个模式都限制在单行内；
    // 多行 $$ 块公式在编辑器保持源码态，由卡片侧渲染
    const dRe = /\$\$([^$\n]+?)\$\$/g
    let m: RegExpExecArray | null
    while ((m = dRe.exec(text))) {
      if (!isPlausibleMath(m[1]!, true)) continue
      taken.push({ a: m.index, b: m.index + m[0].length })
      hits.push({
        from: from + m.index,
        to: from + m.index + m[0].length,
        latex: m[1]!,
        display: true,
        overlaps(o) {
          return this.from < o.to && o.from < this.to
        },
      })
    }

    const sRe = /\$([^$\n]+?)\$/g
    while ((m = sRe.exec(text))) {
      if (!isPlausibleMath(m[1]!, false)) continue
      const a = m.index
      const b = m.index + m[0].length
      if (taken.some((x) => a < x.b && x.a < b)) continue
      hits.push({
        from: from + a,
        to: from + b,
        latex: m[1]!,
        display: false,
        overlaps(o) {
          return this.from < o.to && o.from < this.to
        },
      })
    }
  }

  // 光标进入公式 → 该公式临时回到源码态（可编辑）
  const editable = hits.filter((h) => !overlapsSelection(h.from, h.to))
  editable.sort((x, y) => x.from - y.from)

  const builder = new RangeSetBuilder<Decoration>()
  for (const h of editable) {
    builder.add(
      h.from,
      h.to,
      Decoration.replace({
        widget: new MathWidget(h.latex, h.display),
        block: false,
      }),
    )
  }
  return builder.finish()
}

/** 行内 KaTeX 预览扩展：文档、选区、视口任一变化即重算 */
export const inlineMathPreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = collect(view)
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged)
        this.decorations = collect(u.view)
    }
  },
  { decorations: (v) => v.decorations },
)
