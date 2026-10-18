import { useMemo, useRef, useState } from 'react'
import { Pencil, ChevronLeft } from 'lucide-react'
import { useStore } from '../store'
import { parseDocument } from '../core/document/parse'

/** 行高常量：正文与行号槽必须共用同一度量，否则滚动同步会错位 */
const LINE_H = 21.25 // 12.5px * 1.7

/** 编辑器浮动玻璃面板（可折叠）——行号槽 + 当前行高亮，Obsidian 式 */
export const EditorPanel = ({ onCollapse }: { onCollapse: () => void }) => {
  const { markdown, setMarkdown } = useStore()
  const doc = useMemo(() => parseDocument(markdown), [markdown])

  const taRef = useRef<HTMLTextAreaElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [cursorLine, setCursorLine] = useState(0)
  const lineCount = useMemo(() => markdown.split('\n').length, [markdown])

  const syncCursor = () => {
    const ta = taRef.current
    if (!ta) return
    setCursorLine(markdown.slice(0, ta.selectionStart).split('\n').length - 1)
  }

  return (
    <div className="glass absolute bottom-5 left-5 top-4 z-10 flex w-[400px] flex-col rounded-[20px]">
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

      {/* 编辑区：行号槽 absolute 定位随正文滚动平移；wrap=off 保证行号与行一一对应 */}
      <div className="relative min-h-0 flex-1 py-1 pr-1 pb-3">
        <div className="relative h-full">
          {/* 行号槽 */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 overflow-hidden">
            <div
              className="pr-2 text-right font-mono text-[10.5px] text-ink-faint select-none"
              style={{ paddingTop: 10, lineHeight: `${LINE_H}px`, transform: `translateY(${-scrollTop}px)` }}
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className={i === cursorLine ? 'font-semibold text-ink-soft' : ''}>
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          <textarea
            ref={taRef}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            onKeyUp={syncCursor}
            onClick={syncCursor}
            onSelect={syncCursor}
            spellCheck={false}
            wrap="off"
            className="h-full w-full resize-none overflow-x-auto bg-transparent pr-2 font-mono text-[12.5px] text-ink caret-accent outline-none"
            style={{ paddingLeft: 44, paddingTop: 10, paddingBottom: 12, lineHeight: `${LINE_H}px`, whiteSpace: 'pre' }}
            placeholder={'# 标题\n\n正文…'}
          />
        </div>
      </div>
    </div>
  )
}
