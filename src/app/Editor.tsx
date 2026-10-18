import { useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, ChevronLeft } from 'lucide-react'
import { useStore } from '../store'
import { parseDocument } from '../core/document/parse'

/** 行高常量：正文与行号槽必须共用同一度量，否则滚动同步会错位 */
const LINE_H = 21.25 // 12.5px * 1.7
const PAD_TOP = 10
const PAD_LEFT = 44
const PAD_RIGHT = 8
const MONO_FONT = '"SF Mono", ui-monospace, "JetBrains Mono", Consolas, monospace'

/**
 * 行号与真实行对应、正文软换行（Typora 行为）：
 * 用 canvas 逐行 measureText 计算每条逻辑行折成几个视觉行（行宽/内容宽），
 * 行号锚定在逻辑行块顶部，槽体总高 = Σ视觉行 × LINE_H，与 textarea 滚动天然同步。
 */
function useLogicalLineMetrics(markdown: string, contentWidth: number) {
  return useMemo(() => {
    const lines = markdown.split('\n')
    if (contentWidth <= 0) {
      return { lines, rows: lines.map(() => 1), offsets: lines.map(() => 0) }
    }
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.font = `12.5px ${MONO_FONT}`
    const rows: number[] = []
    const offsets: number[] = []
    let acc = 0
    for (const line of lines) {
      const width = ctx.measureText(line).width
      const n = Math.max(1, Math.ceil(width / contentWidth))
      offsets.push(acc)
      acc += n
      rows.push(n)
    }
    if (rows.length === 0) rows.push(1)
    return { lines, rows, offsets }
  }, [markdown, contentWidth])
}

/** 编辑器浮动玻璃面板（可折叠）——软换行 + 逻辑行号，Obsidian 式 */
export const EditorPanel = ({ onCollapse }: { onCollapse: () => void }) => {
  const { markdown, setMarkdown } = useStore()
  const doc = useMemo(() => parseDocument(markdown), [markdown])

  const taRef = useRef<HTMLTextAreaElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [cursorLine, setCursorLine] = useState(0)
  const [contentWidth, setContentWidth] = useState(0)

  const { lines, rows } = useLogicalLineMetrics(markdown, contentWidth)
  const totalVisualRows = rows.reduce((a, b) => a + b, 0)

  // 内容宽（文本框 clientWidth − 左右内边距）随面板/窗口变化重新测量
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    const update = () => setContentWidth(ta.clientWidth - PAD_LEFT - PAD_RIGHT)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(ta)
    return () => ro.disconnect()
  }, [])

  const syncCursor = () => {
    const ta = taRef.current
    if (!ta) return
    setCursorLine(markdown.slice(0, ta.selectionStart).split('\n').length - 1)
  }

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

      <div className="relative min-h-0 flex-1 pb-3 pr-1 pt-1">
        <div className="relative h-full">
          {/* 行号槽：同宽同字体同行高，逻辑行块高度=Σ视觉行，随滚动平移 */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 overflow-hidden">
            <div
              className="pr-2 text-right font-mono text-[10.5px] text-ink-faint select-none"
              style={{ paddingTop: PAD_TOP, lineHeight: `${LINE_H}px`, transform: `translateY(${-scrollTop}px)`, height: totalVisualRows * LINE_H + PAD_TOP }}
            >
              {lines.map((_, i) => (
                <div key={i} className="relative" style={{ height: rows[i]! * LINE_H }}>
                  <span
                    className={i === cursorLine ? 'font-semibold text-ink-soft' : ''}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
                  >
                    {i + 1}
                  </span>
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
            spellCheck={false}
            className="h-full w-full resize-none bg-transparent font-mono text-[12.5px] text-ink caret-accent outline-none"
            style={{
              paddingLeft: PAD_LEFT,
              paddingRight: PAD_RIGHT,
              paddingTop: PAD_TOP,
              paddingBottom: 12,
              lineHeight: `${LINE_H}px`,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
            placeholder={'# 标题\n\n正文…'}
          />
        </div>
      </div>
    </div>
  )
}
