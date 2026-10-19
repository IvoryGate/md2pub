import { useRef, useState, type ReactNode } from 'react'
import {
  XHS_THEMES,
  applyXhsOverrides,
  type XhsLayout,
  type XhsStyleOverrides,
  type XhsCardTheme,
  type HeadingDecoration,
} from '../platforms/xhs'
import { Check, ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useStore } from '../store'

/**
 * 样式属性面板（Figma / PS 属性栏气质）：
 * - 分组可折叠；标签 10px、数值 24px 高、两列排布，信息密度高但不拥挤
 * - 数值可拖拽 scrub、也可键盘 ↑↓ 微调；单位弱化显示
 * - 中性面板底色 + 细描边，强调色只用于选中态（不用大面积玻璃/粉色）
 */

/* ---------- 基础控件 ---------- */

const Section = ({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-black/[0.055] last:border-0">
      <button className="group flex h-8 w-full items-center gap-1.5 px-3 text-left" onClick={() => setOpen(!open)}>
        <ChevronDown
          className={`h-2.5 w-2.5 text-ink-faint transition-transform ${open ? '' : '-rotate-90'}`}
          strokeWidth={2.4}
        />
        <h3 className="flex-1 text-[10.5px] font-semibold tracking-[0.06em] text-[#6d6d66]">{title}</h3>
      </button>
      {open && <div className="px-3 pb-2.5">{children}</div>}
    </section>
  )
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-[9.5px] font-medium tracking-[0.04em] text-ink-faint">{label}</span>
    {children}
  </label>
)

const Pair = ({ children }: { children: ReactNode }) => <div className="mb-1.5 grid grid-cols-2 gap-1.5 last:mb-0">{children}</div>

const fmt = (v: number, step: number) =>
  step < 0.05 ? v.toFixed(2) : step < 1 ? v.toFixed(1).replace(/\.0$/, '') : String(Math.round(v))

/** 数值输入：可拖拽 scrub（横向）+ 键盘上下微调 */
const Num = ({
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (v: number) => void
}) => {
  const drag = useRef<{ x: number; v: number; moved: boolean } | null>(null)
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step))
  return (
    <span className="group relative flex h-6 items-center rounded-md bg-black/[0.045] px-1.5 transition-colors focus-within:bg-white focus-within:ring-1 focus-within:ring-black/[0.14] hover:bg-black/[0.07]">
      <input
        className="w-full cursor-ew-resize bg-transparent text-[11px] tabular-nums text-ink outline-none"
        style={{ cursor: 'ew-resize' }}
        inputMode="decimal"
        value={fmt(value, step)}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isNaN(n)) onChange(clamp(n))
        }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, v: value, moved: false }
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const dx = e.clientX - d.x
          if (!d.moved && Math.abs(dx) > 3) d.moved = true
          if (d.moved) onChange(clamp(d.v + Math.round(dx / 3) * step))
        }}
        onPointerUp={() => (drag.current = null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            onChange(clamp(value + (e.key === 'ArrowUp' ? step : -step)))
          }
        }}
      />
      {suffix && <span className="pointer-events-none ml-0.5 text-[9px] text-ink-faint">{suffix}</span>}
    </span>
  )
}

const Seg = <V extends string | number>({
  value,
  options,
  onChange,
}: {
  value: V
  options: Array<{ value: V; label: string }>
  onChange: (v: V) => void
}) => (
  <div className="flex h-6 items-center gap-0.5 rounded-md bg-black/[0.045] p-0.5">
    {options.map((o) => (
      <button
        key={String(o.value)}
        className={`h-full flex-1 rounded-[4px] text-[10.5px] transition-colors ${
          o.value === value ? 'bg-white font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-ink-soft hover:text-ink'
        }`}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </button>
    ))}
  </div>
)

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    className={`relative h-[15px] w-[26px] shrink-0 rounded-full transition-colors ${value ? 'bg-[#1d1d1f]' : 'bg-black/[0.16]'}`}
    onClick={() => onChange(!value)}
  >
    <span
      className={`absolute top-[2px] h-[11px] w-[11px] rounded-full bg-white shadow-sm transition-all ${value ? 'left-[13px]' : 'left-[2px]'}`}
    />
  </button>
)

const ToggleRow = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
  <div className="mb-1.5 flex h-6 items-center justify-between last:mb-0">
    <span className="text-[10.5px] text-ink-soft">{label}</span>
    <Toggle value={value} onChange={onChange} />
  </div>
)

const TextInput = ({
  value,
  placeholder,
  onChange,
  multiline,
}: {
  value: string
  placeholder: string
  onChange: (v: string) => void
  multiline?: boolean
}) => {
  const cls =
    'w-full rounded-md bg-black/[0.045] px-2 text-[11px] text-ink outline-none transition-colors placeholder:text-ink-faint hover:bg-black/[0.07] focus:bg-white focus:ring-1 focus:ring-black/[0.14]'
  return multiline ? (
    <textarea
      rows={2}
      className={`${cls} resize-none py-1.5 leading-relaxed`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ) : (
    <input className={`${cls} h-6`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  )
}

/* ---------- 面板 ---------- */

const DECORATIONS: Array<{ value: HeadingDecoration; label: string }> = [
  { value: 'none', label: '无' },
  { value: 'bar', label: '竖条' },
  { value: 'underline', label: '下划线' },
  { value: 'twin', label: '双条' },
  { value: 'dots', label: '圆点' },
  { value: 'pill', label: '胶囊' },
]

export const Sidebar = ({ baseTheme }: { baseTheme: XhsCardTheme }) => {
  const { themeId, setThemeId, overrides, patchLayout, resetOverrides, watermark, setWatermark, coverText, setCoverText } =
    useStore()
  const L: XhsLayout = applyXhsOverrides(baseTheme, overrides).layout
  const [headingTab, setHeadingTab] = useState<'h1' | 'h2' | 'h3' | 'h4'>('h2')
  const patch = (p: XhsStyleOverrides) => patchLayout(p)
  const H = L.headings[headingTab]

  return (
    <aside className="absolute bottom-5 right-5 top-4 z-10 flex w-[336px] flex-col overflow-hidden rounded-[14px] border border-black/[0.07] bg-[#fcfcfa]/95 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      {/* 面板头 */}
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-black/[0.06] px-3">
        <SlidersHorizontal className="h-3 w-3 text-ink-faint" strokeWidth={1.9} />
        <span className="text-[11.5px] font-semibold tracking-[0.02em]">属性</span>
        <div className="flex-1" />
        <button
          className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-black/[0.06] hover:text-ink"
          onClick={resetOverrides}
          title="重置为当前预设的默认值"
        >
          <RotateCcw className="h-3 w-3" strokeWidth={2} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* 预设 */}
        <Section title="样式预设" defaultOpen>
          <div className="grid gap-1">
            {XHS_THEMES.map((t) => {
              const active = themeId === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  className={`flex h-8 items-center gap-2 rounded-md border px-1.5 text-left transition-colors ${
                    active ? 'border-black/[0.18] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]' : 'border-transparent hover:bg-black/[0.04]'
                  }`}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 flex-col items-center justify-center gap-[2px] rounded-[5px]"
                    style={{ background: t.palette.bg, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}
                  >
                    <span className="h-0.5 w-2.5 rounded-full" style={{ background: t.palette.heading }} />
                    <span className="h-[2px] w-3 rounded-full" style={{ background: t.palette.accent }} />
                  </span>
                  <span className={`flex-1 text-[11px] ${active ? 'font-medium text-ink' : 'text-ink-soft'}`}>{t.name}</span>
                  {active && <Check className="h-3 w-3 text-ink" strokeWidth={2.4} />}
                </button>
              )
            })}
          </div>
        </Section>

        {/* 封面 */}
        <Section title="封面" defaultOpen>
          <ToggleRow label="显示封面" value={L.coverOn} onChange={(v) => patch({ coverOn: v })} />
          {L.coverOn && (
            <div className="mt-1.5 space-y-1.5">
              <Field label="标题">
                <TextInput
                  value={coverText.title}
                  placeholder="封面标题"
                  multiline
                  onChange={(v) => setCoverText({ title: v })}
                />
              </Field>
              <p className="text-[9px] leading-relaxed text-ink-faint">回车换行 = 断行位置；标签用逗号或空格分隔</p>
              <Pair>
                <Field label="副标题">
                  <TextInput value={coverText.subtitle} placeholder="可选" onChange={(v) => setCoverText({ subtitle: v })} />
                </Field>
                <Field label="作者">
                  <TextInput value={coverText.author} placeholder="可选" onChange={(v) => setCoverText({ author: v })} />
                </Field>
              </Pair>
              <Field label="标签">
                <TextInput value={coverText.tags} placeholder="游戏, 出海" onChange={(v) => setCoverText({ tags: v })} />
              </Field>
              <Field label="版式">
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      ['classic', '经典'],
                      ['vertical', '竖排'],
                      ['big', '巨字'],
                      ['editorial', '杂志'],
                      ['jacket', '书封'],
                      ['index', '索引'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => patch({ coverStyle: value })}
                      className={`h-6 rounded-[5px] text-[10.5px] transition-colors ${
                        L.coverStyle === value ? 'bg-[#1d1d1f] font-medium text-white' : 'bg-black/[0.045] text-ink-soft hover:bg-black/[0.08]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
              {L.coverStyle === 'classic' ? (
                <Pair>
                  <Field label="经典位置">
                    <Seg
                      value={L.cover}
                      options={[
                        { value: 'top' as const, label: '上' },
                        { value: 'center' as const, label: '中' },
                        { value: 'bottom' as const, label: '下' },
                      ]}
                      onChange={(v) => patch({ cover: v })}
                    />
                  </Field>
                  <Field label="标题字号">
                    <Num
                      value={L.coverTitleScale ?? 1}
                      min={0.8}
                      max={1.3}
                      step={0.05}
                      suffix="×"
                      onChange={(v) => patch({ coverTitleScale: v })}
                    />
                  </Field>
                </Pair>
              ) : (
                <div className="w-1/2 pr-[3px]">
                  <Field label="标题字号">
                    <Num
                      value={L.coverTitleScale ?? 1}
                      min={0.8}
                      max={1.3}
                      step={0.05}
                      suffix="×"
                      onChange={(v) => patch({ coverTitleScale: v })}
                    />
                  </Field>
                </div>
              )}
              <div className="mt-2 border-t border-black/[0.055] pt-2">
                <ToggleRow label="封面水印" value={L.watermark.cover} onChange={(v) => patch({ watermark: { cover: v } })} />
                <Field label="水印位置">
                  <Seg
                    value={L.watermark.coverPos}
                    options={[
                      { value: 'left' as const, label: '左' },
                      { value: 'center' as const, label: '中' },
                      { value: 'right' as const, label: '右' },
                    ]}
                    onChange={(v) => patch({ watermark: { coverPos: v } })}
                  />
                </Field>
              </div>
            </div>
          )}
        </Section>

        {/* 页面 */}
        <Section title="页面">
          <Pair>
            <Field label="上边距">
              <Num value={L.padding.top} min={40} max={200} onChange={(v) => patch({ padding: { top: v } })} />
            </Field>
            <Field label="下边距">
              <Num value={L.padding.bottom} min={40} max={200} onChange={(v) => patch({ padding: { bottom: v } })} />
            </Field>
          </Pair>
          <Pair>
            <Field label="左边距">
              <Num value={L.padding.left} min={40} max={200} onChange={(v) => patch({ padding: { left: v } })} />
            </Field>
            <Field label="右边距">
              <Num value={L.padding.right} min={40} max={200} onChange={(v) => patch({ padding: { right: v } })} />
            </Field>
          </Pair>
          <ToggleRow label="页眉话题标签" value={L.header.showTag} onChange={(v) => patch({ header: { showTag: v } })} />
          <ToggleRow label="页码（右下）" value={L.header.showPageNum} onChange={(v) => patch({ header: { showPageNum: v } })} />
        </Section>

        {/* 正文 */}
        <Section title="正文" defaultOpen>
          <Pair>
            <Field label="字号">
              <Num value={L.body.size} min={26} max={54} suffix="px" onChange={(v) => patch({ body: { size: v } })} />
            </Field>
            <Field label="行距">
              <Num value={L.body.lineRatio} min={1.2} max={2.2} step={0.05} suffix="×" onChange={(v) => patch({ body: { lineRatio: v } })} />
            </Field>
          </Pair>
          <Pair>
            <Field label="段距">
              <Num value={L.body.paragraphSpacing} min={0} max={64} suffix="px" onChange={(v) => patch({ body: { paragraphSpacing: v } })} />
            </Field>
            <Field label="字距">
              <Num value={L.body.letterSpacing} min={0} max={5} step={0.5} suffix="px" onChange={(v) => patch({ body: { letterSpacing: v } })} />
            </Field>
          </Pair>
        </Section>

        {/* 标题 */}
        <Section title="标题" defaultOpen>
          <Seg
            value={headingTab}
            options={[
              { value: 'h1' as const, label: 'H1' },
              { value: 'h2' as const, label: 'H2' },
              { value: 'h3' as const, label: 'H3' },
              { value: 'h4' as const, label: 'H4' },
            ]}
            onChange={setHeadingTab}
          />
          <div className="mt-1.5">
            <Pair>
              <Field label="字号比">
                <Num value={H.sizeRatio} min={0.8} max={2} step={0.05} suffix="×" onChange={(v) => patch({ headings: { [headingTab]: { sizeRatio: v } } as XhsStyleOverrides['headings'] })} />
              </Field>
              <Field label="字距">
                <Num value={H.tracking ?? L.body.letterSpacing} min={0} max={8} step={0.5} suffix="px" onChange={(v) => patch({ headings: { [headingTab]: { tracking: v } } as XhsStyleOverrides['headings'] })} />
              </Field>
            </Pair>
            <Pair>
              <Field label="段前">
                <Num value={H.spaceBefore} min={0} max={100} suffix="px" onChange={(v) => patch({ headings: { [headingTab]: { spaceBefore: v } } as XhsStyleOverrides['headings'] })} />
              </Field>
              <Field label="段后">
                <Num value={H.spaceAfter} min={0} max={50} suffix="px" onChange={(v) => patch({ headings: { [headingTab]: { spaceAfter: v } } as XhsStyleOverrides['headings'] })} />
              </Field>
            </Pair>
            <Field label="字重">
              <Seg
                value={H.weight}
                options={[500, 600, 700, 800].map((w) => ({ value: w, label: String(w) }))}
                onChange={(v) => patch({ headings: { [headingTab]: { weight: v } } as XhsStyleOverrides['headings'] })}
              />
            </Field>
            <div className="mt-1.5">
              <Field label="装饰">
                <div className="grid grid-cols-3 gap-1">
                  {DECORATIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => patch({ headings: { [headingTab]: { decoration: d.value } } as XhsStyleOverrides['headings'] })}
                      className={`h-6 rounded-[5px] text-[10.5px] transition-colors ${
                        H.decoration === d.value ? 'bg-[#1d1d1f] font-medium text-white' : 'bg-black/[0.045] text-ink-soft hover:bg-black/[0.08]'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="mt-1.5">
              <Field label="对齐">
                <Seg
                  value={H.align}
                  options={[
                    { value: 'left' as const, label: '左' },
                    { value: 'center' as const, label: '中' },
                  ]}
                  onChange={(v) => patch({ headings: { [headingTab]: { align: v } } as XhsStyleOverrides['headings'] })}
                />
              </Field>
            </div>
          </div>
        </Section>

        {/* 列表 · 引用 */}
        <Section title="列表 · 引用">
          <Pair>
            <Field label="条目间距">
              <Num value={L.list.itemGap} min={0} max={40} suffix="px" onChange={(v) => patch({ list: { itemGap: v } })} />
            </Field>
            <Field label="分隔线空隙">
              <Num value={L.divider.gapY} min={0} max={64} suffix="px" onChange={(v) => patch({ divider: { gapY: v } })} />
            </Field>
          </Pair>
          <Pair>
            <Field label="引用内边距">
              <Num value={L.quote.pad} min={10} max={48} suffix="px" onChange={(v) => patch({ quote: { pad: v } })} />
            </Field>
            <Field label="引用圆角">
              <Num value={L.quote.radius} min={0} max={24} suffix="px" onChange={(v) => patch({ quote: { radius: v } })} />
            </Field>
          </Pair>
        </Section>

        {/* 代码 · 表格 */}
        <Section title="代码 · 表格">
          <Pair>
            <Field label="代码字号比">
              <Num value={L.code.sizeRatio} min={0.4} max={1.0} step={0.02} suffix="×" onChange={(v) => patch({ code: { sizeRatio: v } })} />
            </Field>
            <Field label="代码内边距">
              <Num value={L.code.pad} min={8} max={48} suffix="px" onChange={(v) => patch({ code: { pad: v } })} />
            </Field>
          </Pair>
          <Pair>
            <Field label="代码圆角">
              <Num value={L.code.radius} min={0} max={28} suffix="px" onChange={(v) => patch({ code: { radius: v } })} />
            </Field>
            <Field label="表格字号比">
              <Num value={L.table.sizeRatio} min={0.45} max={0.9} step={0.02} suffix="×" onChange={(v) => patch({ table: { sizeRatio: v } })} />
            </Field>
          </Pair>
          <Pair>
            <Field label="单元格边距">
              <Num value={L.table.cellPad} min={6} max={28} suffix="px" onChange={(v) => patch({ table: { cellPad: v } })} />
            </Field>
            <div className="flex items-end">
              <ToggleRow label="代码语言标签" value={L.code.showLang} onChange={(v) => patch({ code: { showLang: v } })} />
            </div>
          </Pair>
        </Section>

        {/* 图片 */}
        <Section title="图片">
          <Pair>
            <Field label="圆角">
              <Num value={L.image.radius} min={0} max={28} suffix="px" onChange={(v) => patch({ image: { radius: v } })} />
            </Field>
            <Field label="上下留白">
              <Num value={L.image.marginY} min={0} max={48} suffix="px" onChange={(v) => patch({ image: { marginY: v } })} />
            </Field>
          </Pair>
          <Pair>
            <div className="flex items-end">
              <ToggleRow label="通栏出血" value={L.image.fullBleed} onChange={(v) => patch({ image: { fullBleed: v } })} />
            </div>
            <div className="flex items-end">
              <ToggleRow label="细描边" value={L.image.outline} onChange={(v) => patch({ image: { outline: v } })} />
            </div>
          </Pair>
        </Section>

        {/* 水印 */}
        <Section title="水印">
          <ToggleRow label="正文显示水印" value={L.watermark.enabled} onChange={(v) => patch({ watermark: { enabled: v } })} />
          <Field label="位置">
            <Seg
              value={L.watermark.pos}
              options={[
                { value: 'left' as const, label: '左' },
                { value: 'center' as const, label: '中' },
                { value: 'right' as const, label: '右' },
              ]}
              onChange={(v) => patch({ watermark: { pos: v } })}
            />
          </Field>
          <div className="mt-1.5">
            <Field label="文案">
              <TextInput value={watermark} placeholder="@你的账号" onChange={setWatermark} />
            </Field>
          </div>
        </Section>
      </div>
    </aside>
  )
}
