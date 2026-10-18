import { useMemo } from 'react'
import { useStore } from '../store'
import { parseDocument } from '../core/document/parse'

/** 编辑器浮动玻璃面板（可折叠）——只保留必要 chrome */
export const EditorPanel = ({ onCollapse }: { onCollapse: () => void }) => {
  const { markdown, setMarkdown } = useStore()
  const doc = useMemo(() => parseDocument(markdown), [markdown])

  return (
    <div className="glass absolute bottom-24 left-5 top-4 z-10 flex w-[400px] flex-col rounded-[20px]">
      <div className="flex h-11 shrink-0 items-center gap-2 px-4">
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
          ‹
        </button>
      </div>
      <div className="min-h-0 flex-1 px-1 pb-1">
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          spellCheck={false}
          className="h-full w-full resize-none rounded-b-[18px] bg-transparent px-3 pb-3 font-mono text-[12.5px] leading-[1.7] text-ink caret-accent outline-none"
          placeholder={'# 标题\n\n正文…'}
        />
      </div>
    </div>
  )
}
