import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, ChevronLeft } from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView, type ViewUpdate } from '@codemirror/view'
import { markdown as markdownLang } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { parseDocument } from '../core/document/parse'
import { inlineMathPreview } from './cm/inlineMath'
import { codeBlockStyler, fencedLines } from './cm/codeBlock'
import { bindSyncScroll, type ScrollBus } from './scrollSync'
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
    for (const el of view.contentDOM.querySelectorAll<HTMLElement>('.cm-line')) {
      const r = el.getBoundingClientRect()
      if (r.bottom < base || r.top > limit) continue
      const line = doc.lineAt(view.posAtDOM(el, 0))
      const isFence = fenced.has(line.number)
      const mh = isFence ? null : /^(#{1,6})(\s|$)/.exec(line.text)
      // 标题单行 → 条带=块高；段落软换行 → 条带=首视觉行；围栏行 → 该行实测高
      const rowH = mh
        ? Math.min(r.height, BASE_ROW_H * HEADING_MULT[Math.min(6, mh[1].length) - 1]!)
        : Math.min(r.height, BASE_ROW_H)
      out.push({
        n: line.number,
        top: r.top - base,
        h: rowH,
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
    const ro = new ResizeObserver(schedule)
    ro.observe(holder)
    schedule()
    return () => {
      ro.disconnect()
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
  bus: ScrollBus
}) => {
  const markdown = useStore((s) => s.markdown)
  const setMarkdown = useStore((s) => s.setMarkdown)
  const doc = useMemo(() => parseDocument(markdown), [markdown])

  const holderRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const { nums, schedule } = useLineNumbers(viewRef, holderRef)

  const extensions = useMemo(
    () => [
      markdownLang(),
      EditorView.lineWrapping,
      syntaxHighlighting(mdHighlight),
      inlineMathPreview,
      codeBlockStyler,
      cmTheme,
    ],
    [],
  )

  return (
    <div className="glass absolute bottom-5 left-5 top-4 z-10 flex w-[470px] flex-col rounded-[20px]">
      <div className="flex h-11 shrink-0 items-center gap-2 px-4">
        <Pencil className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.8} />
        <span className="text-[13px] font-semibold">编辑器</span>
        <span className="ml-1 rounded-full bg-black/5 px-2 py-0.5 text-[10.5px] tabular-nums text-ink-soft">
          {doc.blocks.length} 块
        </span>
        <div className="flex-1" />
        <button
          className="flex h-6 w-6 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-black/5 hover:text-ink"
          onClick={onCollapse}
          title="收起面板"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>

      {/* 编辑区：CodeMirror + 自绘行号覆盖层；滚动经 bus 与卡片轨道同步 */}
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
            bindSyncScroll(view.scrollDOM, 'editor', bus)
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
    </div>
  )
}
