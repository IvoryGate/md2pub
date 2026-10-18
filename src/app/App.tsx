import { useState } from 'react'
import { PanelLeftOpen } from 'lucide-react'
import { XhsPreview } from './XhsPreview'
import { EditorPanel } from './Editor'
import { Sidebar } from './Sidebar'
import { useStore } from '../store'
import { getTheme, applyXhsOverrides } from '../platforms/xhs'

const App = () => {
  const { themeId, overrides, size } = useStore()
  const [editorOpen, setEditorOpen] = useState(true)
  // 生效主题 = 所选主题预设 + 用户参数覆盖
  const theme = applyXhsOverrides(getTheme(themeId), overrides)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden text-ink">
      {/* 顶栏（融入画布，无分界线） */}
      <header className="relative z-20 flex h-12 shrink-0 items-center px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6.5 w-6.5 items-center justify-center rounded-[7px] bg-ink text-[11px] font-black text-white shadow-sm">
            x2
          </div>
          <span className="text-[14px] font-bold tracking-[-0.01em]">md2pub</span>
        </div>

        <nav className="segmented ml-5">
          <button className="on">小红书</button>
          <button disabled className="cursor-not-allowed opacity-45" title="建设中">公众号</button>
        </nav>

        <div className="flex-1" />
        <div className="segmented">
          {(['3:4', '1:1', '4:5'] as const).map((s) => (
            <button key={s} className={size === s ? 'on' : ''} onClick={() => useStore.getState().setSize(s)}>
              {s}
            </button>
          ))}
        </div>
      </header>

      {/* 全幅画布 */}
      <main
        className="canvas-grid relative min-h-0 flex-1"
        style={{
          // CSS 变量驱动卡片轨道避让浮动面板（面板收起时自动回收空间）
          '--rail-pl': editorOpen ? '508px' : '36px',
          '--rail-pr': '344px',
        } as React.CSSProperties}
      >
        {/* 编辑器浮动面板（可折叠） */}
        {editorOpen ? (
          <EditorPanel onCollapse={() => setEditorOpen(false)} />
        ) : (
          <button
            className="glass absolute left-5 top-4 z-10 flex h-10 items-center gap-2 rounded-2xl px-4 text-[13px] font-semibold text-ink transition-transform hover:scale-[1.02]"
            onClick={() => setEditorOpen(true)}
          >
            <PanelLeftOpen className="h-4 w-4 text-ink-soft" strokeWidth={1.8} />
            编辑器
          </button>
        )}

        {/* 样式设置浮动面板 */}
        <Sidebar baseTheme={theme} />

        {/* 画布内容（卡片轨道 + 底部工具条） */}
        <XhsPreview />
      </main>
    </div>
  )
}

export default App
