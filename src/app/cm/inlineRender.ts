import {
  ViewPlugin,
  Decoration,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { fencedLines } from './codeBlock'

/**
 * 行内渲染（Obsidian 实时预览式）：光标不在其上时隐藏 markdown 行内标记——
 * - **strong** / __strong__ / *em* / _em_ / ~~del~~ / `code`：只藏定界符，文本保留渲染态
 * - [label](url)：隐藏 `[` 与 `](url)`，只留标题
 * 公式（$…$）由 inlineMath 插件负责，本插件只处理文本级标记。
 * 围栏行内不处理。光标压到匹配处 → 该匹配临时回到源码态（可编辑）。
 */
const inlineRe =
  /(`+)([^`\n]+?)\1|\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|(?<!\*)\*([^*\n]+?)\*(?!\*)|(?<![_\w])_([^_\n]+?)_(?![\w])|~~([^~\n]+?)~~|\[([^\]\n]+)\]\(([^)\n]+)\)/g

function collect(view: EditorView): DecorationSet {
  const sel = view.state.selection.ranges
  const fenced = fencedLines(view.state.doc)
  const builder = new RangeSetBuilder<Decoration>()
  const ranges: Array<[number, number]> = []

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    // 逐行扫描（标记不跨行），围栏行内跳过
    inlineRe.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = inlineRe.exec(text))) {
      const start = from + m.index
      const end = start + m[0].length
      if (text.slice(m.index, m.index + m[0].length).includes('\n')) continue
      // 该行是否为围栏行
      const lineNo = view.state.doc.lineAt(start).number
      if (fenced.has(lineNo)) continue
      // 光标压到该标记 → 保持源码态
      if (sel.some((r) => r.from < end && r.to > start)) continue

      if (m[1] !== undefined) {
        // 行内码：藏首尾反引号组
        const tick = m[1].length
        ranges.push([start, start + tick])
        ranges.push([end - tick, end])
      } else if (m[3] !== undefined || m[4] !== undefined) {
        ranges.push([start, start + 2])
        ranges.push([end - 2, end])
      } else if (m[5] !== undefined || m[6] !== undefined) {
        ranges.push([start, start + 1])
        ranges.push([end - 1, end])
      } else if (m[7] !== undefined) {
        ranges.push([start, start + 2])
        ranges.push([end - 2, end])
      } else if (m[8] !== undefined) {
        // [label](url)：藏 `[` 与 `](url)`
        ranges.push([start, start + 1])
        ranges.push([start + 1 + m[8]!.length, end])
      }
    }
  }

  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const seen = new Set<string>()
  for (const [f, t] of ranges) {
    const key = `${f}:${t}`
    if (seen.has(key)) continue
    seen.add(key)
    builder.add(f, t, Decoration.replace({}))
  }
  return builder.finish()
}

/** 行内渲染开关扩展（Editor 的 inlinePreview=true 时挂载） */
export const inlineRender = ViewPlugin.fromClass(
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
