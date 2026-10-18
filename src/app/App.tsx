import { XhsPreview } from './XhsPreview'
import Editor from './Editor'
import { Sidebar } from './Sidebar'
import { useStore } from '../store'
import { getTheme, applyXhsOverrides } from '../platforms/xhs'

const App = () => {
  const { themeId, overrides } = useStore()
  // 生效主题 = 所选主题预设 + 用户在样式面板的参数覆盖
  const theme = applyXhsOverrides(getTheme(themeId), overrides)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-paper text-ink">
      {/* 顶栏 */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
        {/* 品牌 */}
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-[11px] font-black text-paper">
            x2
          </div>
          <span className="text-[13.5px] font-bold tracking-tight">md2pub</span>
        </div>

        {/* 平台 Tab */}
        <nav className="ml-3 flex items-center gap-0.5 rounded-lg bg-sunken p-0.5">
          <button className="rounded-md bg-panel px-3 py-1 text-[12.5px] font-semibold text-ink shadow-sm">
            小红书
          </button>
          <button disabled className="cursor-not-allowed rounded-md px-3 py-1 text-[12.5px] text-ink-faint" title="下一站：微信公众号排版">
            公众号
          </button>
        </nav>

        <div className="flex-1" />

        <span className="hidden text-[11px] text-ink-faint lg:inline">排版参数实时生效 · 所有产物本地生成</span>
      </header>

      {/* 三栏：编辑 / 画布 / 样式面板 */}
      <main className="grid min-h-0 flex-1 grid-cols-[minmax(320px,30%)_1fr_288px]">
        <section className="min-h-0 overflow-hidden border-r border-line">
          <Editor />
        </section>
        <section className="min-h-0">
          <XhsPreview />
        </section>
        <section className="min-h-0">
          <Sidebar baseTheme={theme} />
        </section>
      </main>
    </div>
  )
}

export default App
