import { Decoration, WidgetType, EditorView, type DecorationSet } from '@codemirror/view'
import { StateField, type EditorState, type Range } from '@codemirror/state'
import { diagramSvg, renderMathHtml } from '../../platforms/shared-blocks'
import { renderInline } from '../../core/document/parse'

/**
 * 编辑模式「实时预览」（Obsidian 对位）：
 *
 * 块级（整块渲染，光标压上退回源码）：
 * - ```mermaid / ```plantuml 围栏 → 成图
 * - GFM 表格 → 成表
 * - 多行 $$ 公式块 → KaTeX display
 *
 * 行级（标记隐藏 / 部件替身，逐行独立）：
 * - 标题 # / ## / … → 隐藏标记，靠语法高亮呈现标题字号
 * - 分割线 --- / *** / ___ → 整行替换为水平线部件
 * - 列表 - / * / + → 替换为圆点部件；有序列表数字保留
 * - 任务 [ ] / [x] → 复选框部件
 * - 引用 > → 隐藏箭头 + 行装饰画竖条
 *
 * 约束：块级 replace 装饰不能来自 ViewPlugin 的函数式 facet 输入，
 * 全部挂 StateField，经 EditorView.decorations.from(field) 注入。
 */

const fenceOpenRe = /^\s{0,3}(```|~~~)\s*([\w-]*)\s*$/
const fenceCloseRe = /^\s{0,3}(```|~~~)\s*$/
const tableRowRe = /^\s*\|.*\|\s*$/
const tableSepRe = /^\s*\|?[\s:\-|]*-[\s:\-|]*\|?\s*$/
const headingMarkerRe = /^(#{1,6})(\s+)/
const hrRe = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/
const listMarkerRe = /^(\s*)([-*+])(\s+)/
const taskMarkerRe = /^(\s*)([-*+])(\s+)\[([ xX])\]\s+/
const quoteMarkerRe = /^(\s{0,3}>\s?)+/

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

type BlockKind = 'mermaid' | 'plantuml' | 'table' | 'math' | 'code'

interface Slot {
  from: number
  to: number
  kind: BlockKind
  /** 表格 → 单元文本；图/代码 → 源码；公式 → LaTeX */
  content: string
  /** 代码围栏的语言标签 */
  lang?: string
  /** 块起始行号（代码部件行号用绝对值，与源码态一致） */
  startLine: number
}

// ---------- 部件 ----------

/** 通用：块高变化后通知行号覆盖层重算（CM 无事务可监听） */
const bridgeGeometry = (wrap: HTMLElement, onDispose?: () => void) => {
  const refresh = () => window.dispatchEvent(new Event('cm-ln-refresh'))
  const ro = new ResizeObserver(refresh)
  ro.observe(wrap)
  ;(wrap as HTMLElement & { __dispose?: () => void }).__dispose = () => {
    ro.disconnect()
    onDispose?.()
  }
}

class BlockWidget extends WidgetType {
  constructor(
    readonly kind: 'mermaid' | 'plantuml' | 'table' | 'math',
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
    if (this.kind === 'table') {
      const lines = this.content.split('\n')
      wrap.innerHTML = renderTableHtml(parseRow(lines[0]!), lines.slice(2).map(parseRow))
      bridgeGeometry(wrap)
      return wrap
    }
    if (this.kind === 'math') {
      wrap.classList.add('cm-block-math')
      wrap.textContent = this.content
      try {
        wrap.innerHTML = renderMathHtml(this.content, '#c0564e')
      } catch {
        /* 保留源码文本 */
      }
      bridgeGeometry(wrap)
      return wrap
    }
    let alive = true
    wrap.textContent = this.content
    bridgeGeometry(wrap, () => {
      alive = false
    })
    diagramSvg(this.kind, this.content)
      .then((svg) => {
        if (!alive) return
        wrap.innerHTML = svg
        wrap.classList.add('has-svg')
        window.dispatchEvent(new Event('cm-ln-refresh'))
      })
      .catch((err) => {
        if (!alive) return
        wrap.classList.add('is-error')
        wrap.textContent = `${this.kind} 渲染失败：${String(err?.message ?? err)}`
        window.dispatchEvent(new Event('cm-ln-refresh'))
      })
    return wrap
  }
  override destroy(dom: HTMLElement): void {
    ;(dom as HTMLElement & { __dispose?: () => void }).__dispose?.()
  }
  override ignoreEvent(): boolean {
    return false
  }
}

/** 代码块部件：整块渲染成粉色代码框（语言头带 + 行号 + 等宽正文） */
class CodeWidget extends WidgetType {
  constructor(
    readonly lang: string,
    readonly text: string,
    readonly startLine: number,
  ) {
    super()
  }
  override eq(other: this): boolean {
    return (
      other.lang === this.lang && other.text === this.text && other.startLine === this.startLine
    )
  }
  override toDOM(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cm-block-widget cm-code-widget'
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const head = document.createElement('div')
    head.className = 'cm-code-head'
    head.textContent = this.lang || 'text'
    wrap.appendChild(head)
    // 行号列宽用 grid max-content 自动分配（ch 单位受字体回退影响会和期望不符）
    const body = document.createElement('div')
    body.className = 'cm-code-body'
    wrap.appendChild(body)
    const lines = this.text.length ? this.text.split('\n') : ['']
    lines.forEach((ln, idx) => {
      const n = document.createElement('span')
      n.className = 'cm-code-n'
      n.textContent = String(this.startLine + 1 + idx)
      const t = document.createElement('span')
      t.className = 'cm-code-t'
      t.innerHTML = esc(ln) || '&nbsp;'
      body.appendChild(n)
      body.appendChild(t)
    })
    return wrap
  }
  override ignoreEvent(): boolean {
    return false
  }
}

/** 分割线部件：整行替换成一条水平线 */
class RuleWidget extends WidgetType {
  override eq(): boolean {
    return true
  }
  override toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-rule-widget'
    return span
  }
  override ignoreEvent(): boolean {
    return false
  }
}

/** 无序列表圆点部件 */
class BulletWidget extends WidgetType {
  override eq(): boolean {
    return true
  }
  override toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-bullet-widget'
    span.textContent = '•'
    return span
  }
  override ignoreEvent(): boolean {
    return false
  }
}

/** 任务清单复选框部件（只读展示，点击进源码态编辑） */
class TaskWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super()
  }
  override eq(other: this): boolean {
    return other.checked === this.checked
  }
  override toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-task-widget' + (this.checked ? ' is-checked' : '')
    return span
  }
  override ignoreEvent(): boolean {
    return false
  }
}

// ---------- 装饰收集 ----------

function collect(state: EditorState): DecorationSet {
  const doc = state.doc
  const sel = state.selection.ranges
  const deco: Array<Range<Decoration>> = []
  const blocks: Slot[] = []

  const cursorIn = (from: number, to: number) =>
    sel.some((r) => r.from <= to && r.to >= from)

  // front-matter 区（文档首行 --- 起）保持源码态，不与分割线规则冲突
  let fmEnd = 0
  if (doc.lines > 1 && doc.line(1).text.trim() === '---') {
    for (let k = 2; k <= doc.lines; k++) {
      if (doc.line(k).text.trim() === '---') {
        fmEnd = k
        break
      }
    }
  }

  let i = fmEnd + 1
  while (i <= doc.lines) {
    const line = doc.line(i)
    const text = line.text

    // ---- 围栏：所有围栏都整段跳过（防止把代码块里的 $$ / 表格当成块渲染）
    const fm = fenceOpenRe.exec(text)
    if (fm) {
      const lang = fm[2] ?? ''
      const isDiagram = lang === 'mermaid' || lang === 'plantuml'
      let j = i + 1
      while (j <= doc.lines && !fenceCloseRe.test(doc.line(j).text)) j++
      const endLine = doc.line(Math.min(j, doc.lines))
      const innerFrom = line.from + text.length + 1
      const innerTo = j <= doc.lines ? endLine.from - 1 : endLine.to
      const content =
        innerFrom <= innerTo ? doc.sliceString(innerFrom, Math.min(innerTo, doc.length)) : ''
      blocks.push({
        from: line.from,
        to: endLine.to,
        kind: isDiagram ? (lang as 'mermaid' | 'plantuml') : 'code',
        content,
        lang,
        startLine: i,
      })
      i = j + 1
      continue
    }

    // ---- 块级公式：$$ 独占一行的多行块（单行 $$…$$ 由行内公式插件负责）
    if (/^\s*\$\$/.test(text)) {
      const head = text.trim()
      if (!(head.length > 4 && head.endsWith('$$'))) {
        const firstInner = head.slice(2).trim()
        const innerLines: string[] = firstInner ? [firstInner] : []
        let j = i + 1
        let closed = false
        while (j <= doc.lines) {
          const t = doc.line(j).text.trim()
          const idx = t.indexOf('$$')
          if (idx >= 0) {
            const tail = t.slice(0, idx).trim()
            if (tail) innerLines.push(tail)
            closed = true
            break
          }
          innerLines.push(doc.line(j).text)
          j++
        }
        if (closed) {
          const content = innerLines.join('\n').trim()
          if (content) {
            blocks.push({
              from: line.from,
              to: doc.line(j).to,
              kind: 'math',
              content,
              startLine: i,
            })
            i = j + 1
            continue
          }
        }
      }
      i++
      continue
    }

    // ---- GFM 表格：表头行 + 分隔行 + 若干数据行
    if (tableRowRe.test(text) && i + 1 <= doc.lines) {
      const sep = doc.line(i + 1)
      if (tableSepRe.test(sep.text) && sep.text !== text) {
        let j = i + 2
        while (j <= doc.lines && tableRowRe.test(doc.line(j).text)) j++
        const lastRow = doc.line(j - 1)
        blocks.push({
          from: line.from,
          to: lastRow.to,
          kind: 'table',
          content: doc.sliceString(line.from, lastRow.to),
          startLine: i,
        })
        i = j
        continue
      }
    }

    // ---- 行级实时预览
    const taskM = taskMarkerRe.exec(text)
    if (taskM) {
      // 圆点 + [x] 一并替换为复选框
      const start = line.from + taskM[1]!.length
      const end = line.from + taskM[0].length
      if (!cursorIn(start, end))
        deco.push(
          Decoration.replace({ widget: new TaskWidget(taskM[4] !== ' ') }).range(start, end),
        )
      i++
      continue
    }

    const bulletM = listMarkerRe.exec(text)
    if (bulletM) {
      const start = line.from + bulletM[1]!.length
      const end = start + bulletM[2]!.length + bulletM[3]!.length
      if (!cursorIn(start, end))
        deco.push(Decoration.replace({ widget: new BulletWidget() }).range(start, end))
      i++
      continue
    }

    if (headingMarkerRe.test(text)) {
      const len = headingMarkerRe.exec(text)![0].length
      const start = line.from
      const end = line.from + len
      if (!cursorIn(start, end)) deco.push(Decoration.replace({}).range(start, end))
      i++
      continue
    }

    if (hrRe.test(text)) {
      if (!cursorIn(line.from, line.to))
        deco.push(
          Decoration.replace({ widget: new RuleWidget() }).range(line.from, line.to),
        )
      i++
      continue
    }

    const quoteM = quoteMarkerRe.exec(text)
    if (quoteM) {
      const end = line.from + quoteM[0].length
      if (!cursorIn(line.from, end)) deco.push(Decoration.replace({}).range(line.from, end))
      deco.push(Decoration.line({ class: 'cm-quote-line' }).range(line.from))
      i++
      continue
    }

    i++
  }

  // ---- 块级部件（光标压到块上 → 整块退回源码）
  for (const s of blocks) {
    if (cursorIn(s.from, s.to)) continue
    deco.push(
      Decoration.replace({
        block: true,
        widget:
          s.kind === 'code'
            ? new CodeWidget(s.lang ?? '', s.content, s.startLine)
            : new BlockWidget(s.kind, s.content),
      }).range(s.from, s.to),
    )
  }

  return Decoration.set(deco, true)
}

/** 实时预览装饰按状态存储（新版 CM 的块级装饰必须来自静态 facet 解析值） */
const livePreviewField = StateField.define<DecorationSet>({
  create: collect,
  update(value, tr): DecorationSet {
    if (tr.docChanged || tr.selection) return collect(tr.state)
    return value
  },
  provide: (f) => EditorView.decorations.from(f),
})

/** 编辑模式实时预览扩展（editorMode === 'edit' 时挂载） */
export const livePreview = [
  livePreviewField,
  // 原子区间：光标点击渲染块时映射到块边缘 → 触发源码态回退
  EditorView.atomicRanges.of((view) => view.state.field(livePreviewField, false) ?? Decoration.none),
]
