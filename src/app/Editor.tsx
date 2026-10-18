import { useMemo } from 'react'
import { Pencil, ChevronLeft } from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { markdown as markdownLang } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { parseDocument } from '../core/document/parse'
import { inlineMathPreview } from './cm/inlineMath'
import { codeBlockStyler } from './cm/codeBlock'
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

const cmTheme = EditorView.theme({
  '&': { fontSize: '12.5px', color: INK, backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: MONO,
    lineHeight: '1.7',
    padding: '6px 10px 16px 2px',
  },
  '.cm-content': { caretColor: ACCENT },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: ACCENT, borderLeftWidth: '2px' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: FAINT },
  '.cm-lineNumbers .cm-gutterElement': { fontSize: '10.5px' },
  '.cm-activeLine': { backgroundColor: 'rgba(0,0,0,0.03)' },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: SOFT,
    fontWeight: '600',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(255,36,66,0.13) !important',
  },
  '.cm-placeholder': { color: FAINT },
})

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

      {/* 编辑区：CodeMirror 接管行号/软换行/高亮；滚动经 bus 与卡片轨道同步 */}
      <div className="relative min-h-0 flex-1 overflow-hidden pb-2">
        <CodeMirror
          value={markdown}
          onChange={setMarkdown}
          extensions={extensions}
          theme={cmTheme}
          height="100%"
          style={{ height: '100%' }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            autocompletion: false,
            bracketMatching: false,
            closeBrackets: false,
            searchKeymap: false,
            highlightSelectionMatches: false,
          }}
          onCreateEditor={(view) => {
            bindSyncScroll(view.scrollDOM, 'editor', bus)
          }}
        />
      </div>
    </div>
  )
}
