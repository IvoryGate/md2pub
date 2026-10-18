import { XHS_THEMES, type XhsPadding, type XhsTypography, type XhsCardTheme } from '../platforms/xhs'
import { Palette, Check, RotateCcw } from 'lucide-react'
import { useStore } from '../store'

/** 样式设置浮动面板：主题预设 + 排版参数，无解释文案 */

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-b border-black/[0.06] px-4 pb-4 pt-3.5 last:border-0">
    <h3 className="mb-2.5 text-[11.5px] font-semibold text-ink-soft">{title}</h3>
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
  <div className="mb-2 flex items-center gap-2.5 last:mb-0">
    <span className="w-[62px] shrink-0 text-[12px] text-ink-soft">{label}</span>
    <input
      type="range"
      className="xhs-slider min-w-0 flex-1"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
    <span className="w-10 shrink-0 text-right font-mono text-[10.5px] tabular-nums text-ink-faint">
      {step < 1 ? value.toFixed(1) : Math.round(value)}
    </span>
  </div>
)

export const Sidebar = ({ baseTheme }: { baseTheme: XhsCardTheme }) => {
  const { themeId, setThemeId, patchPadding, patchTypography, resetOverrides, watermark, setWatermark } = useStore()

  // 面板实时值 = 主题预设 + 用户覆盖（滑杆反映实际生效值）
  const margin: XhsPadding = baseTheme.page.padding
  const typo: XhsTypography = baseTheme.page.typography

  return (
    <aside className="glass absolute bottom-5 right-5 top-4 z-10 flex w-[312px] flex-col overflow-hidden rounded-[20px]">
      {/* 面板头 */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-black/[0.06] px-4">
        <Palette className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.8} />
        <span className="text-[13px] font-semibold">样式设置</span>
        <div className="flex-1" />
        <button
          className="flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-80"
          onClick={resetOverrides}
        >
          <RotateCcw className="h-3 w-3" strokeWidth={2} />
          重置样式
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* 主题预设 */}
        <Section title="样式预设">
          <div className="grid gap-1.5">
            {XHS_THEMES.map((t) => {
              const active = t.id === themeId
              return (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  className={`flex items-center gap-2.5 rounded-xl border p-2 text-left transition-all ${
                    active
                      ? 'border-black/[0.22] bg-white shadow-[0_0_0_3px_rgba(0,0,0,0.05)]'
                      : 'border-transparent hover:bg-black/[0.035]'
                  }`}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 flex-col items-center justify-center gap-[3px] rounded-lg p-1"
                    style={{ background: t.palette.bg, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}
                  >
                    <div className="h-1 w-3.5 rounded-full" style={{ background: t.palette.heading }} />
                    <div className="h-[3px] w-4.5 rounded-full" style={{ background: t.palette.accent }} />
                  </div>
                  <div className={`text-[12.5px] font-medium ${active ? 'text-ink' : 'text-ink-soft'}`}>{t.name}</div>
                  {active && <Check className="ml-auto h-3.5 w-3.5 text-ink" strokeWidth={2} />}
                </button>
              )
            })}
          </div>
        </Section>

        {/* 页边距 */}
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
          <input
            className="w-full rounded-lg bg-black/[0.05] px-2.5 py-1.5 text-[12.5px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:bg-black/[0.08]"
            value={watermark}
            onChange={(e) => setWatermark(e.target.value)}
            placeholder="@你的账号"
          />
        </Section>
      </div>
    </aside>
  )
}
