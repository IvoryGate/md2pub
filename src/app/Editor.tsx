import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, ChevronLeft, CodeXml, BookOpen, SeparatorHorizontal, Bold, Italic, Code, Link2, Heading2, List, Quote } from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView, type ViewUpdate } from '@codemirror/view'
import { markdown as markdownLang } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { inlineMathPreview } from './cm/inlineMath'
import { inlineRender } from './cm/inlineRender'
import { livePreview } from './cm/livePreview'
import { codeBlockStyler, fencedLines } from './cm/codeBlock'
import { animateScroll, type LineBus } from './scrollSync'
import { ReadView } from './ReadView'
import { useStore } from '../store'

const INK = '#1d1d1f'
const SOFT = '#6e6e73'
const FAINT = '#aeaeb2'
const ACCENT = '#ff2442'
const MONO = '"SF Mono", ui-monospace, "JetBrains Mono", Consolas, monospace'

/** 行内预览高亮：标题变大加粗、强调/删除线/链接/引用/标记淡化 */
const mdHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.55em', fontWeight: '800', color: INK },
  { tag: tags.heading2, fontSize: '1.3em', fontWeight: '700', color: INK },
  { tag: tags.heading3, fontSize: '1.15em', fontWeight: '700', color: INK },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '650', color: INK },
  { tag: tags.strong, fontWeight: '700', color: INK },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  {
    tag: tags.monospace,
    color: '#3f2b2b',
  },
  { tag: tags.link, color: ACCENT },
  { tag: tags.url, color: FAINT },
  { tag: tags.quote, color: SOFT, fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.meta], color: FAINT },
])

/** 编号列宽：内容左内边距 = NUM_W + 8 */
const NUM_W = 44
/** 首视觉行条带高度（12.5px 字号 × 1.7 行高），标题按级别倍增 */
const BASE_ROW_H = 12.5 * 1.7 // 21.25px
const HEADING_MULT = [1.55, 1.3, 1.15, 1, 1, 1] as const

interface LineNum {
  /** 源文档行号 */
  n: number
  /** 相对编辑器容器顶部的条带顶（px） */
  top: number
  /** 条带高（=首视觉行高；整块行即块高） */
  h: number
  active: boolean
}

/** Obsidian 式字数统计：CJK 字符逐个计词 + 拉丁词按空白分词；字符数不含空白 */
function countWordsAndChars(md: string) {
  // 剥离 front-matter（统计正文才有意义）
  const body = md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
  const cjk = body.match(/[\u3400-\u9fff\uf900-\ufaff]/g)?.length ?? 0
  const latin = body.match(/[A-Za-z0-9][A-Za-z0-9'’_\-]*/g)?.length ?? 0
  const chars = body.replace(/\s/g, '').length
  return { words: cjk + latin, chars }
}

const cmTheme = EditorView.theme({
  '&': { fontSize: '12.5px', color: INK, backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: MONO,
    lineHeight: '1.7',
    // 左侧让出编号列（自绘 overlay），不再占用 CM gutter
    padding: `6px 10px 16px ${NUM_W + 8}px`,
  },
  '.cm-content': { caretColor: ACCENT },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: ACCENT, borderLeftWidth: '2px' },
  '.cm-activeLine': { backgroundColor: 'rgba(0,0,0,0.03)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(255,36,66,0.13) !important',
  },
  '.cm-placeholder': { color: FAINT },
})

/**
 * 行号覆盖层：不走 CM gutter（装饰 CSS 的 margin 不进 CM 高度图，格子布局必然漂移），
 * 而是在编辑器容器上绝对定位一枚 overlay，按对齐规则摆放编号：
 * - 整块单行（标题/hr/围栏带内行）→ 编号在该块实测矩形内垂直居中
 * - 软换行段落 → 编号只对第一条视觉行居中（条带高度按首行截断）
 * - 围栏框 → 框内每行各自居中；框体外 margin（14px）由编号矩形自然跟随
 * 几何来源是 `.cm-line` 的 getBoundingClientRect —— 与真实布局物理同步，不可能错位。
 */
function useLineNumbers(
  viewRef: React.RefObject<EditorView | null>,
  holderRef: React.RefObject<HTMLDivElement | null>,
) {
  const [nums, setNums] = useState<LineNum[]>([])
  const rafRef = useRef(0)

  const recompute = useCallback(() => {
    const view = viewRef.current
    const holder = holderRef.current
    if (!view || !holder || !holder.isConnected) return
    const base = holder.getBoundingClientRect().top
    const limit = base + holder.clientHeight
    const doc = view.state.doc
    const fenced = fencedLines(doc)
    const activeN = doc.lineAt(view.state.selection.main.head).number
    const out: LineNum[] = []
    // 普通行 + 块级渲染部件（整块渲染的 mermaid/表格）：按 DOM 顺序统一遍历
    for (const el of view.contentDOM.querySelectorAll<HTMLElement>('.cm-line, .cm-block-widget')) {
      const r = el.getBoundingClientRect()
      if (r.bottom < base || r.top > limit) continue
      // 块级部件 → 编号对整块垂直居中（单一渲染块规则的自然延伸）
      if (el.classList.contains('cm-block-widget')) {
        const line = doc.lineAt(view.posAtDOM(el, 0))
        out.push({
          n: line.number,
          top: r.top - base,
          h: r.height,
          active: line.number === activeN,
        })
        continue
      }
      const line = doc.lineAt(view.posAtDOM(el, 0))
      const isFence = fenced.has(line.number)
      // 行的垂直间距改用 padding（CM 不测量 margin），编号对准 padding 之后的文字行
      const cs = getComputedStyle(el)
      const padTop = parseFloat(cs.paddingTop) || 0
      const mh = isFence ? null : /^(#{1,6})(\s|$)/.exec(line.text)
      // 标题单行 → 条带=块高；段落软换行 → 条带=首视觉行；围栏行 → 该行实测高
      const rowH = mh
        ? Math.min(r.height, BASE_ROW_H * HEADING_MULT[Math.min(6, mh[1].length) - 1]! + padTop)
        : Math.min(r.height, BASE_ROW_H)
      out.push({
        n: line.number,
        top: r.top - base + padTop,
        h: Math.max(12, rowH - padTop),
        active: line.number === activeN,
      })
    }
    setNums(out)
  }, [viewRef, holderRef])

  const schedule = useCallback(() => {
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        recompute()
      })
    }
  }, [recompute])

  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    // 块级渲染部件（mermaid 等）异步插入 svg 后会改变几何——监听刷新事件
    window.addEventListener('cm-ln-refresh', schedule)
    const onMeasure = () => viewRef.current?.requestMeasure()
    window.addEventListener('cm-measure', onMeasure)
    const ro = new ResizeObserver(schedule)
    ro.observe(holder)
    schedule()
    return () => {
      ro.disconnect()
      window.removeEventListener('cm-ln-refresh', schedule)
      window.removeEventListener('cm-measure', onMeasure)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
    }
  }, [schedule, holderRef])

  return { nums, schedule, viewRef }
}

/** 编辑器浮动玻璃面板（可折叠）—— CodeMirror 语法高亮 + KaTeX 行内预览 */
export const EditorPanel = ({
  onCollapse,
  bus,
}: {
  onCollapse: () => void
  bus: LineBus
}) => {
  const markdown = useStore((s) => s.markdown)
  const setMarkdown = useStore((s) => s.setMarkdown)
  const editorMode = useStore((s) => s.editorMode)
  const setEditorMode = useStore((s) => s.setEditorMode)
  const stats = useMemo(() => countWordsAndChars(markdown), [markdown])
  const fmt = (n: number) => n.toLocaleString('en-US')

  const holderRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const syncRef = useRef<(() => void) | null>(null)
  useEffect(() => () => syncRef.current?.(), [])
  const { nums, schedule } = useLineNumbers(viewRef, holderRef)

  /** 在光标处执行编辑动作（阅读模式下先切回编辑） */
  const withView = (fn: (view: EditorView) => void) => {
    if (editorMode === 'read') setEditorMode('edit')
    window.setTimeout(() => {
      const view = viewRef.current
      if (!view) return
      fn(view)
      view.focus()
    }, 60)
  }

  /** 行内标记：**bold** / *italic* / `code` */
  const wrapInline = (mark: string, placeholder: string) =>
    withView((view) => {
      const { from, to } = view.state.selection.main
      const text = view.state.sliceDoc(from, to) || placeholder
      const insert = mark + text + mark
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + mark.length, head: from + mark.length + text.length },
      })
    })

  const insertLink = () =>
    withView((view) => {
      const { from, to } = view.state.selection.main
      const text = view.state.sliceDoc(from, to) || '链接文字'
      const url = 'https://'
      const insert = `[${text}](${url})`
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + text.length + 3, head: from + text.length + 3 + url.length },
      })
    })

  /** 行首前缀：标题/列表/引用（已存在则移除） */
  const prefixLine = (prefix: string) =>
    withView((view) => {
      const { from } = view.state.selection.main
      const line = view.state.doc.lineAt(from)
      if (view.state.sliceDoc(line.from, line.from + prefix.length) === prefix) {
        view.dispatch({
          changes: { from: line.from, to: line.from + prefix.length, insert: '' },
          selection: { anchor: Math.max(line.from, from - prefix.length) },
        })
      } else {
        view.dispatch({ changes: { from: line.from, insert: prefix }, selection: { anchor: from + prefix.length } })
      }
    })

  /** 在光标处插入分页标记（阅读模式下先切回编辑） */
  const insertPageBreak = () => {
    if (editorMode === 'read') setEditorMode('edit')
    window.setTimeout(() => {
      const view = viewRef.current
      if (!view) return
      const { from, to } = view.state.selection.main
      const nl = String.fromCharCode(10)
      const snippet = nl + nl + '<!-- pagebreak -->' + nl + nl
      view.dispatch({
        changes: { from, to, insert: snippet },
        selection: { anchor: from + snippet.length },
      })
      view.focus()
    }, 60)
  }

  // 块级渲染部件（mermaid / 表格 / 公式）点击即回到源码态：
  // CM 对块部件下半个区域的点击会映射到块之后，这里在捕获阶段拦截，
  // 直接把光标放进块起始位置（选区与块相交 → 块退回源码）。
  useEffect(() => () => syncRef.current?.(), [])

  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    const onDown = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('.cm-block-widget')
      const view = viewRef.current
      if (!el || !view) return
      e.preventDefault()
      e.stopPropagation()
      view.focus()
      view.dispatch({
        selection: { anchor: view.posAtDOM(el as HTMLElement, 0) },
        scrollIntoView: false,
      })
    }
    holder.addEventListener('mousedown', onDown, true)
    return () => holder.removeEventListener('mousedown', onDown, true)
  }, [])

  const extensions = useMemo(
    () => [
      markdownLang(),
      EditorView.lineWrapping,
      syntaxHighlighting(mdHighlight),
      // 实时预览（edit 模式）才挂行内渲染 + 块级渲染；source 模式 = 纯源码
      ...(editorMode === 'edit' ? [inlineMathPreview, inlineRender, livePreview] : []),
      codeBlockStyler,
      cmTheme,
    ],
    [editorMode],
  )

  return (
    <div className="glass absolute bottom-5 left-5 top-4 z-10 flex w-[470px] flex-col rounded-[20px]">
      {/* 三段式头部：左（铅笔+标题）· 中（字数统计绝对居中）· 右（开关+收起） */}
      <div className="relative flex h-11 shrink-0 items-center px-4">
        <div className="flex items-center gap-1.5">
          <Pencil className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.8} />
          <span className="text-[13px] font-semibold leading-none">编辑器</span>
        </div>
        {/* Obsidian 式字数统计：纯文本、无胶囊底，水平居中 */}
        <span className="pointer-events-none absolute left-1/2 top-1/2 max-w-[46%] -translate-x-1/2 -translate-y-1/2 truncate whitespace-nowrap text-[11px] leading-none tabular-nums text-ink-faint">
          {fmt(stats.words)} 词 {fmt(stats.chars)} 字符
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/* 三模式切换（Obsidian 对位）：源码 `</>` / 编辑 / 阅读 */}
          <nav className="segmented icon-only">
            {(['source', 'edit', 'read'] as const).map((m) => (
              <button
                key={m}
                className={editorMode === m ? 'on' : ''}
                onClick={() => setEditorMode(m)}
                title={
                  m === 'source'
                    ? '源码模式：纯 markdown 源码'
                    : m === 'edit'
                      ? '编辑模式：实时预览（行内半渲染）'
                      : '阅读模式：完整渲染，不可编辑'
                }
              >
                {m === 'source' ? (
                  <CodeXml className="h-3.5 w-3.5" strokeWidth={1.8} />
                ) : m === 'edit' ? (
                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                ) : (
                  <BookOpen className="h-3.5 w-3.5" strokeWidth={1.8} />
                )}
              </button>
            ))}
          </nav>
          <button
            className="flex h-6 w-6 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-black/5 hover:text-ink"
            onClick={onCollapse}
            title="收起面板"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* 格式快捷工具条（源码/编辑模式） */}
      {editorMode !== 'read' && (
        <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-black/[0.05] px-2">
          {[
            { icon: Bold, title: '加粗 **text**', run: () => wrapInline('**', '加粗') },
            { icon: Italic, title: '斜体 *text*', run: () => wrapInline('*', '斜体') },
            { icon: Code, title: '行内代码 `code`', run: () => wrapInline('`', 'code') },
            { icon: Link2, title: '链接 [text](url)', run: insertLink },
            { icon: Heading2, title: '标题（## ）', run: () => prefixLine('## ') },
            { icon: List, title: '列表（- ）', run: () => prefixLine('- ') },
            { icon: Quote, title: '引用（> ）', run: () => prefixLine('> ') },
          ].map(({ icon: Icon, title, run }) => (
            <button
              key={title}
              className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-black/[0.06] hover:text-ink"
              onClick={run}
              title={title}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          ))}
          <div className="mx-1 h-3.5 w-px bg-black/10" />
          <button
            className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[10.5px] text-ink-faint transition-colors hover:bg-black/[0.06] hover:text-ink"
            onClick={insertPageBreak}
            title="在光标处插入分页标记"
          >
            <SeparatorHorizontal className="h-3.5 w-3.5" strokeWidth={1.8} />
            分页
          </button>
        </div>
      )}

      {/* 编辑/源码：CodeMirror + 自绘行号覆盖层；阅读：整页渲染。滚动经 bus 与卡片轨道同步 */}
      {editorMode === 'read' ? (
        <ReadView markdown={markdown} bus={bus} />
      ) : (
        <div ref={holderRef} className="relative min-h-0 flex-1 overflow-hidden pb-2">
          <CodeMirror
            value={markdown}
            onChange={setMarkdown}
            extensions={extensions}
            theme={cmTheme}
            height="100%"
            style={{ height: '100%' }}
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLine: true,
              highlightActiveLineGutter: false,
              autocompletion: false,
              bracketMatching: false,
              closeBrackets: false,
              searchKeymap: false,
              highlightSelectionMatches: false,
            }}
            onCreateEditor={(view) => {
              viewRef.current = view
              syncRef.current?.()
              // 位置级联动：上报顶部可见行；接收轨道行号并滚动到对应位置
              let raf = 0
              const onScroll = () => {
                if (raf) return
                raf = requestAnimationFrame(() => {
                  raf = 0
                  if (bus.info.applying) return
                  const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop + 6)
                  const line = view.state.doc.lineAt(block.from).number - 1
                  bus.reportLine('editor', line)
                })
              }
              view.scrollDOM.addEventListener('scroll', onScroll, { passive: true })
              // 点击块级部件（表格/公式/图表/代码）→ 光标落入该块，装饰自动退回源码
              const onWidgetDown = (e: MouseEvent) => {
                const t = (e.target as HTMLElement | null)?.closest('.cm-block-widget') as HTMLElement | null
                if (!t) return
                try {
                  const pos = view.posAtDOM(t, 0)
                  view.dispatch({ selection: { anchor: pos } })
                  view.focus()
                  e.preventDefault()
                } catch {
                  /* ignore */
                }
              }
              view.contentDOM.addEventListener('mousedown', onWidgetDown, true)
              const unsub = bus.onLine((src, line) => {
                if (src === 'editor' || bus.info.applying) return
                bus.info.applying = true
                const target = Math.min(Math.max(1, line + 1), view.state.doc.lines)
                const block = view.lineBlockAt(view.state.doc.line(target).from)
                animateScroll(view.scrollDOM, Math.max(0, block.top - 6), 340).then(() => {
                  // 动画结束再静默 80ms，吞掉尾部 scroll 回声
                  window.setTimeout(() => {
                    bus.info.applying = false
                  }, 80)
                })
              })
              syncRef.current = () => {
                view.scrollDOM.removeEventListener('scroll', onScroll)
                view.contentDOM.removeEventListener('mousedown', onWidgetDown, true)
                unsub()
                if (raf) cancelAnimationFrame(raf)
              }
              view.scrollDOM.addEventListener('scroll', schedule, { passive: true })
              schedule()
            }}
            onUpdate={(u: ViewUpdate) => {
              if (u.docChanged || u.viewportChanged || u.geometryChanged || u.selectionSet) schedule()
            }}
          />
          {/* 自绘行号层：绝对定位 + pointer-events none，跟随真实 .cm-line 矩形 */}
          <div className="editor-ln-layer">
            {nums.map((x) => (
              <div
                key={x.n}
                className={'editor-ln' + (x.active ? ' is-active' : '')}
                style={{ top: x.top, height: x.h, width: NUM_W }}
              >
                {x.n}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
