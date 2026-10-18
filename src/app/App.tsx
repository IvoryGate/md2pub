import { XhsPreview } from './XhsPreview'
import Editor from './Editor'
import { useStore } from '../store'
import { XHS_THEMES, XHS_CARD_SIZES, type XhsCardSizeName } from '../platforms/xhs'

const App = () => {
  const { themeId, setThemeId, size, setSize, watermark, setWatermark } = useStore()

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-stone-100 text-stone-900">
      {/* 顶栏：平台设置 */}
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-stone-900 px-2 py-0.5 text-xs font-bold text-white">md2pub</span>
          <span className="text-xs text-stone-400">Markdown → 小红书 / 公众号</span>
        </div>
        <div className="flex-1" />

        {/* 尺寸 */}
        <label className="flex items-center gap-1.5 text-xs text-stone-500">
          尺寸
          <select
            className="rounded border border-stone-300 bg-white px-1.5 py-1 text-xs"
            value={size}
            onChange={(e) => setSize(e.target.value as XhsCardSizeName)}
          >
            {Object.keys(XHS_CARD_SIZES).map((k) => (
              <option key={k} value={k}>
                {k} · {XHS_CARD_SIZES[k as XhsCardSizeName].width}×{XHS_CARD_SIZES[k as XhsCardSizeName].height}
              </option>
            ))}
          </select>
        </label>

        {/* 主题 */}
        <label className="flex items-center gap-1.5 text-xs text-stone-500">
          主题
          <select
            className="rounded border border-stone-300 bg-white px-1.5 py-1 text-xs"
            value={themeId}
            onChange={(e) => setThemeId(e.target.value)}
          >
            {XHS_THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>

        {/* 水印 */}
        <label className="flex items-center gap-1.5 text-xs text-stone-500">
          水印
          <input
            className="w-24 rounded border border-stone-300 px-1.5 py-1 text-xs"
            value={watermark}
            onChange={(e) => setWatermark(e.target.value)}
            placeholder="留空隐藏"
          />
        </label>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[minmax(360px,34%)_1fr]">
        <section className="min-h-0 border-r border-stone-200">
          <Editor />
        </section>
        <section className="min-h-0">
          <XhsPreview />
        </section>
      </main>
    </div>
  )
}

export default App
