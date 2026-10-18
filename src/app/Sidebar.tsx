import { XHS_THEMES, type XhsPadding, type XhsTypography, type XhsCardTheme } from '../platforms/xhs'
import { useStore } from '../store'

/** 右侧控制面板：主题预设 + 排版参数（页边距/行距/段距/字距/字号），纯参数驱动 */

const Section = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <section className="border-b border-line px-4 py-4">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">{title}</h3>
      {action}
    </div>
    {children}
  </section>
)

const SliderRow = ({
  label, value, min, max, step = 1, onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}) => (
  <div className="mb-2.5 flex items-center gap-2.5 last:mb-0">
    <span className="w-[64px] shrink-0 text-[12px] text-ink-soft">{label}</span>
    <input
      type="range"
      className="xhs-slider min-w-0 flex-1"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
    <span className="w-11 shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-soft">
      {step < 1 ? value.toFixed(step < 0.1 ? 2 : 1) : Math.round(value)}
    </span>
  </div>
)

export const Sidebar = ({ baseTheme }: { baseTheme: XhsCardTheme }) => {
  const { themeId, setThemeId, overrides, patchPadding, patchTypography, resetOverrides, watermark, setWatermark, size, setSize } = useStore()

  // 面板实时值 = 主题预设 + 用户覆盖（保证滑杆反映的是实际生效的排版参数）
  const margin: XhsPadding = baseTheme.page.padding
  const typo: XhsTypography = baseTheme.page.typography
  const dirty = Object.keys(overrides.padding ?? {}).length + Object.keys(overrides.typography ?? {}).length > 0

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-y-auto border-l border-line bg-panel">
      <div className="flex items-center gap-2 border-b border-line bg-panel px-4 py-2.5">
        <span className="text-[13px] font-semibold text-ink">样式面板</span>
        <div className="flex-1" />
        {dirty && (
          <button
            className="rounded-full px-2 py-0.5 text-[11px] text-accent hover:bg-accent-soft"
            onClick={resetOverrides}
          >
            重置
          </button>
        )}
      </div>

      {/* 主题预设（mdnice 式卡片选择） */}
      <Section title="主题">
        <div className="grid gap-2">
          {XHS_THEMES.map((t) => {
            const active = t.id === themeId
            return (
              <button
                key={t.id}
                onClick={() => setThemeId(t.id)}
                className={`flex items-center gap-3 rounded-xl border p-2.5 text-left transition-all ${
                  active
                    ? 'border-accent bg-accent-soft/40 shadow-[0_1px_4px_rgba(255,36,66,0.15)]'
                    : 'border-line hover:border-line-strong hover:bg-paper'
                }`}
              >
                {/* 迷你色板条 */}
                <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-1 rounded-lg p-1" style={{ background: t.palette.bg, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}>
                  <div className="h-1.5 w-4 rounded-full" style={{ background: t.palette.heading }} />
                  <div className="h-1 w-5 rounded-full" style={{ background: t.palette.accent }} />
                </div>
                <div>
                  <div className={`text-[13px] font-medium ${active ? 'text-accent-deep' : 'text-ink'}`}>{t.name}</div>
                  <div className="text-[10.5px] text-ink-faint">
                    {t.page.typography.bodySize}px 行{t.page.typography.lineRatio}
                  </div>
                </div>
                {active && <div className="ml-auto h-2 w-2 rounded-full bg-accent" />}
              </button>
            )
          })}
        </div>
      </Section>

      {/* 页面尺寸 */}
      <Section title="尺寸">
        <div className="grid grid-cols-3 gap-1.5">
          {(['3:4', '1:1', '4:5'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`rounded-lg border py-1.5 text-[12px] transition-colors ${
                size === s ? 'border-accent bg-accent-soft/50 font-semibold text-accent-deep' : 'border-line text-ink-soft hover:bg-paper'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </Section>

      {/* 页边距（Word/ LaTeX 式排版参数） */}
      <Section title="页边距">
        <SliderRow label="上" value={margin.top} min={40} max={200} onChange={(v) => patchPadding({ top: v })} />
        <SliderRow label="下" value={margin.bottom} min={40} max={200} onChange={(v) => patchPadding({ bottom: v })} />
        <SliderRow label="左" value={margin.left} min={40} max={200} onChange={(v) => patchPadding({ left: v })} />
        <SliderRow label="右" value={margin.right} min={40} max={200} onChange={(v) => patchPadding({ right: v })} />
      </Section>

      {/* 字体排版 */}
      <Section title="字体排版">
        <SliderRow label="正文字号" value={typo.bodySize} min={26} max={54} onChange={(v) => patchTypography({ bodySize: v })} />
        <SliderRow label="标题字号" value={typo.headingSize} min={36} max={84} onChange={(v) => patchTypography({ headingSize: v })} />
        <SliderRow label="行距" value={typo.lineRatio} min={1.2} max={2.2} step={0.05} onChange={(v) => patchTypography({ lineRatio: v })} />
        <SliderRow label="段距" value={typo.paragraphSpacing} min={0} max={64} onChange={(v) => patchTypography({ paragraphSpacing: v })} />
        <SliderRow label="字间距" value={typo.letterSpacing} min={0} max={5} step={0.5} onChange={(v) => patchTypography({ letterSpacing: v })} />
        <SliderRow label="标题段前" value={typo.headingSpaceBefore} min={0} max={90} onChange={(v) => patchTypography({ headingSpaceBefore: v })} />
        <SliderRow label="标题段后" value={typo.headingSpaceAfter} min={0} max={50} onChange={(v) => patchTypography({ headingSpaceAfter: v })} />
      </Section>

      {/* 水印 */}
      <Section title="水印">
        <div className="flex items-center gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[12.5px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus:bg-panel"
            value={watermark}
            onChange={(e) => setWatermark(e.target.value)}
            placeholder="@你的账号"
          />
          {watermark && (
            <button
              className="shrink-0 rounded-lg border border-line px-2 py-1.5 text-[11px] text-ink-soft hover:bg-paper"
              onClick={() => setWatermark('')}
            >
              清空
            </button>
          )}
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-ink-faint">左下角展示，留空即隐藏。</p>
      </Section>
    </aside>
  )
}
