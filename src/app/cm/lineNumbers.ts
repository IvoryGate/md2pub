import { gutter, GutterMarker, type EditorView } from '@codemirror/view'
import { fencedLines } from './codeBlock'

/**
 * 行号对齐模型（块级几何对齐的最终版）：
 * - 单行渲染块（H1/H2 放大标题、hr、围栏色带）→ 编号在该块内垂直居中
 * - 折行段落（多视觉行）→ 编号只对「首行视觉行」垂直居中，不跨整段
 * - 围栏块内每行 → 编号随每行文本垂直居中
 * - 编号格高度由 CM 测量镜像（cell height = 渲染块高度、
 *   cell margin-top = 与上一块之间的空隙），本 gutter 只负责"钉在哪"。
 */
const HEADING_MULT = [1.55, 1.3, 1.15, 1, 1, 1] as const // 与 mdHighlight 字号逐级对应
export const BASE_ROW_H = 12.5 * 1.7 // 21.25px（正文行盒高度）

class LineNumberMarker extends GutterMarker {
  constructor(
    readonly n: number,
    readonly rowH: number,
  ) {
    super()
  }
  override eq(other: this): boolean {
    return other.n === this.n && other.rowH === this.rowH
  }
  override toDOM(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'cm-ln-num'
    el.textContent = String(this.n)
    // 钉在块顶部、高度=首行视觉行 → flex 居中即"首行条带居中"
    el.style.height = `${this.rowH}px`
    return el
  }
}

const headingRowH = (text: string, fenced: boolean): number => {
  if (fenced) return BASE_ROW_H
  const m = /^#{1,6}\s/.exec(text)
  if (!m) return BASE_ROW_H
  return BASE_ROW_H * HEADING_MULT[m[0].trimStart().length - 1]!
}

export const lineNumbersGutter = gutter({
  class: 'cm-ln-gutter',
  lineMarker: (view: EditorView, line) => {
    const ln = view.state.doc.lineAt(line.from)
    const fenced = fencedLines(view.state.doc).has(ln.number)
    return new LineNumberMarker(ln.number, headingRowH(ln.text, fenced))
  },
  initialSpacer: (view) => new LineNumberMarker(view.state.doc.lines, BASE_ROW_H),
  updateSpacer: (marker, update) => {
    const lines = update.view.state.doc.lines
    return marker instanceof LineNumberMarker && marker.n === lines
      ? marker
      : new LineNumberMarker(lines, BASE_ROW_H)
  },
})
