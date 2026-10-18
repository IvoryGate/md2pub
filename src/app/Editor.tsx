import { useMemo } from 'react'
import { useStore } from '../store'
import { parseDocument } from '../core/document/parse'

/** 左栏编辑器：主稿 chrome + 统计 + 快捷提示 */
const Editor = () => {
  const { markdown, setMarkdown } = useStore()
  const doc = useMemo(() => parseDocument(markdown), [markdown])
  const lines = markdown.split('\n').length
  const minutes = Math.max(1, Math.round(markdown.replace(/\s/g, '').length / 300))

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      {/* 文件头 */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-4">
        <div className="flex items-center gap-1.5 rounded-md bg-sunken px-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="font-mono text-[11.5px] text-ink-soft">main.md</span>
        </div>
        <div className="flex-1" />
        <span className="text-[11px] tabular-nums text-ink-faint">
          {lines} 行 · {doc.blocks.length} 块 · ~{minutes} 分钟
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          spellCheck={false}
          className="h-full w-full resize-none bg-transparent p-4 font-mono text-[13px] leading-[1.75] text-ink caret-accent outline-none"
          placeholder={'# 标题\n\n正文…'}
        />
      </div>

      {/* 语法提示条 */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-line bg-paper px-4 py-2 text-[10.5px] text-ink-faint">
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-line bg-panel px-1 py-px font-mono text-[10px] text-ink-soft">---</kbd>
          = 分割线
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-line bg-panel px-1 py-px font-mono text-[10px] text-ink-soft">&lt;!--pagebreak--&gt;</kbd>
          = 强制换页
        </span>
        <span>$…$ 公式 · ```mermaid 图表</span>
        <span className="ml-auto text-accent/70">front-matter 同步封面</span>
      </div>
    </div>
  )
}

export default Editor
