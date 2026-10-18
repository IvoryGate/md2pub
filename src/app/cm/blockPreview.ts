import { Decoration, WidgetType, EditorView, type DecorationSet } from '@codemirror/view'
import { RangeSetBuilder, StateField, type EditorState } from '@codemirror/state'
import { diagramSvg } from '../../platforms/shared-blocks'
import { renderInline } from '../../core/document/parse'

/**
 * 编辑模式「块级实时预览」（Obsidian 对位）：
 * - ```mermaid / ```plantuml 围栏整块 → 渲染成图
 * - GFM 表格整块 → 渲染成表格
 * 光标/选区压到该块 → 整块退回源码态（可编辑），光标离开再渲染回。
 * 行号覆盖层读取 .cm-block-widget 元素，编号对整块垂直居中。
 *
 * 实现约束：新版 CM 的块级 replace 装饰不能从 ViewPlugin 的函数式 facet
 * 输入提供（块装饰只允许静态解析值），因此挂在 StateField 上，docChanged /
 * selectionSet 时重算，经 editorView.decorations.from(field) 注入。
 */

const fenceOpenRe = /^\s{0,3}(```|~~~)\s*(mermaid|plantuml)\s*$/
const fenceCloseRe = /^\s{0,3}(```|~~~)\s*$/
const tableRowRe = /^\s*\|.*\|\s*$/
const tableSepRe = /^\s*\|?[\s:\-|]*-[\s:\-|]*\|?\s*$/

/** GFM 表格 → 表格 HTML（与 ReadView 同视觉） */
const renderTableHtml = (head: string[], rows: string[][]): string => {
  const thead = head
    .map((h) => `<th>${renderInline(h.trim())}</th>`)
    .join('')
  const tbody = rows
    .map((r) => `<tr>${r.map((c) => `<td>${renderInline(c.trim())}</td>`).join('')}</tr>`)
    .join('')
  return `<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`
}

const parseRow = (text: string): string[] => {
  let t = text.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|')) t = t.slice(0, -1)
  // 忽略转义（\|）——MVP 够用
  return t.split('|')
}

interface Slot {
  from: number
  to: number
  kind: 'mermaid' | 'plantuml' | 'table'
  /** 表格 → 单元文本；图 → 源码 */
  content: string
}

class BlockWidget extends WidgetType {
  constructor(
    readonly kind: Slot['kind'],
    readonly content: string,
  ) {
    super()
  }
  override eq(other: this): boolean {
    return other.kind === this.kind && other.content === this.content
  }
  override toDOM(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cm-block-widget'
    // svg 异步插入会改变块高，但 CM 不产生事务——通知行号覆盖层重算
    const refreshLn = () => window.dispatchEvent(new Event('cm-ln-refresh'))
    if (this.kind === 'table') {
      const lines = this.content.split('\n')
      wrap.innerHTML = renderTableHtml(parseRow(lines[0]!), lines.slice(2).map(parseRow))
      return wrap
    }
    let alive = true
    wrap.textContent = this.content
    diagramSvg(this.kind, this.content)
      .then((svg) => {
        if (alive) {
          wrap.innerHTML = svg
          wrap.classList.add('has-svg')
          refreshLn()
        }
      })
      .catch((err) => {
        if (alive) {
          wrap.classList.add('is-error')
          wrap.textContent = `${this.kind} 渲染失败：${String(err?.message ?? err)}`
          refreshLn()
        }
      })
    ;(wrap as HTMLElement & { __dispose?: () => void }).__dispose = () => {
      alive = false
    }
    return wrap
  }
  override destroy(dom: HTMLElement): void {
    ;(dom as HTMLElement & { __dispose?: () => void }).__dispose?.()
  }
  override ignoreEvent(): boolean {
    return false
  }
}

function collect(state: EditorState): DecorationSet {
  const doc = state.doc
  const sel = state.selection.ranges
  const slots: Slot[] = []

  let i = 1
  while (i <= doc.lines) {
    const line = doc.line(i)
    const fm = fenceOpenRe.exec(line.text)
    if (fm) {
      const kind = fm[2] as 'mermaid' | 'plantuml'
      let j = i + 1
      while (j <= doc.lines && !fenceCloseRe.test(doc.line(j).text)) j++
      const endLine = doc.line(Math.min(j, doc.lines))
      const innerFrom = line.from + line.text.length + 1
      const innerTo = j <= doc.lines ? endLine.from - 1 : endLine.to
      const content =
        innerFrom <= innerTo ? doc.sliceString(innerFrom, Math.min(innerTo, doc.length)) : ''
      slots.push({ from: line.from, to: endLine.to, kind, content })
      i = j + 1
      continue
    }

    // GFM 表格：表头行 + 分隔行 + 若干数据行
    if (tableRowRe.test(line.text) && i + 1 <= doc.lines) {
      const sep = doc.line(i + 1)
      if (tableSepRe.test(sep.text) && sep.text !== line.text) {
        let j = i + 2
        while (j <= doc.lines && tableRowRe.test(doc.line(j).text)) j++
        const lastRow = doc.line(j - 1)
        const content = doc.sliceString(line.from, lastRow.to)
        slots.push({ from: line.from, to: lastRow.to, kind: 'table', content })
        i = j
        continue
      }
    }
    i++
  }

  const builder = new RangeSetBuilder<Decoration>()
  for (const s of slots) {
    // 光标压到块上 → 退回源码（可编辑）
    if (sel.some((r) => r.from <= s.to && r.to >= s.from)) continue
    builder.add(
      s.from,
      s.to,
      Decoration.replace({
        block: true,
        widget: new BlockWidget(s.kind, s.content),
      }),
    )
  }
  return builder.finish()
}

/** 块装饰按状态存储（新版 CM 的块级装饰必须来自静态 facet 解析值） */
const blockPreviewField = StateField.define<DecorationSet>({
  create: collect,
  update(value, tr): DecorationSet {
    if (tr.docChanged || tr.selection) return collect(tr.state)
    return value
  },
  provide: (f) => EditorView.decorations.from(f),
})

/** 编辑模式块级预览扩展（editorMode === 'edit' 时挂载） */
export const blockPreview = [
  blockPreviewField,
  // 原子区间：光标点击渲染块时映射到块边缘 → 触发源码态回退
  EditorView.atomicRanges.of((view) => {
    return view.state.field(blockPreviewField, false) ?? Decoration.none
  }),
]
