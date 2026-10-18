import { useMemo } from 'react'
import { useStore } from '../store'
import { parseDocument } from '../core/document/parse'

const Editor = () => {
  const { markdown, setMarkdown } = useStore()
  const doc = useMemo(() => parseDocument(markdown), [markdown])
  const lines = markdown.split('\n').length
  const blockCount = doc.blocks.length
  const minutes = Math.max(1, Math.round(markdown.replace(/\s/g, '').length / 300))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-4 border-b border-stone-200 bg-white px-4 py-2">
        <span className="text-sm font-semibold text-stone-700">Markdown</span>
        <div className="flex-1" />
        <span className="text-[11px] text-stone-400">
          {lines} 行 · {blockCount} 块 · 约 {minutes} 分钟阅读
        </span>
      </div>
      <div className="h-full min-h-0 flex-1">
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          spellCheck={false}
          className="h-full w-full resize-none bg-[#fafaf9] p-4 font-mono text-[13px] leading-relaxed text-stone-800 outline-none focus:bg-white"
          placeholder={'# 标题\n\n正文…\n\n---\n\n第二页…'}
        />
      </div>
      <div className="border-t border-stone-200 bg-stone-50 px-4 py-1.5 text-[11px] text-stone-400">
        提示：分页由排版参数（页边距/行距/段距）自动计算；<code className="rounded bg-stone-200 px-1">--- 渲染为分割线</code>；显式分页写
        <code className="mx-1 rounded bg-stone-200 px-1">{'<!-- pagebreak -->'}</code>；文档头部
        Front-matter 的 <code className="mx-1 rounded bg-stone-200 px-1">title / tags / author</code>{' '}
        会同步到封面。
      </div>
    </div>
  )
}

export default Editor
