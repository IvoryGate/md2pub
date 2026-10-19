import { useState } from 'react'
import {
  XHS_THEMES,
  applyXhsOverrides,
  type XhsLayout,
  type XhsStyleOverrides,
  type XhsCardTheme,
} from '../platforms/xhs'
import { Palette, Check, RotateCcw, ChevronDown } from 'lucide-react'
import { useStore } from '../store'

/** 样式设置浮动面板：主题预设 + 版式参数（分区可折叠，控件按元素分组） */

const Section = ({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-black/[0.06] px-4 pb-3 pt-2.5 last:border-0">
      <button
        className="mb-1.5 flex w-full items-center gap-1 text-left"
        onClick={() => setOpen(!open)}
      >
        <ChevronDown
          className={`h-3 w-3 text-ink-faint transition-transform ${open ? '' : '-rotate-90'}`}
          strokeWidth={2}
        />
        <h3 className="flex-1 text-[12px] font-semibold text-ink">{title}</h3>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </section>
  )
}

const SliderRow = ({
  label, value, min, max, step = 1, suffix = '', onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (v: number) => void
}) => (
  <div className="mb-2 flex items-center gap-2.5 last:mb-0">
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
    <span className="w-11 shrink-0 text-right font-mono text-[10.5px] tabular-nums text-ink-faint">
      {step < 1 ? value.toFixed(step < 0.1 ? 2 : 1).replace(/\.?0+$/, '') : Math.round(value)}
      {suffix}
    </span>
  </div>
)

const SegRow = <V extends string | number>({
  label, value, options, onChange,
}: {
  label: string
  value: V
  options: Array<{ value: V; label: string }>
  onChange: (v: V) => void
}) => (
  <div className="mb-2 flex items-center gap-2.5 last:mb-0">
    <span className="w-[64px] shrink-0 text-[12px] text-ink-soft">{label}</span>
    <div className="segmented flex-1">
      {options.map((o) => (
        <button key={String(o.value)} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  </div>
)

const ToggleRow = ({
  label, value, onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) => (
  <div className="mb-2 flex items-center justify-between last:mb-0">
    <span className="text-[12px] text-ink-soft">{label}</span>
    <button
      className={`relative h-[20px] w-[34px] rounded-full transition-colors ${
        value ? 'bg-accent/80' : 'bg-black/[0.14]'
      }`}
      onClick={() => onChange(!value)}
    >
      <span
        className={`absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white shadow transition-all ${
          value ? 'left-[16px]' : 'left-[2px]'
        }`}
      />
    </button>
  </div>
)

export const Sidebar = ({ baseTheme }: { baseTheme: XhsCardTheme }) => {
  const { themeId, setThemeId, overrides, patchLayout, resetOverrides, watermark, setWatermark } = useStore()
  // 面板实时值 = 主题预设 + 用户覆盖（控件反映实际生效值）
  const L: XhsLayout = applyXhsOverrides(baseTheme, overrides).layout
  const [headingTab, setHeadingTab] = useState<'h2' | 'h3' | 'h4'>('h2')
  const patch = (p: XhsStyleOverrides) => patchLayout(p)
  const H = L.headings[headingTab]

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
        <Section title="样式预设" defaultOpen>
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

        {/* 页面骨架 */}
        <Section title="页面" defaultOpen>
          <ToggleRow label="开启封面" value={L.coverOn} onChange={(v) => patch({ coverOn: v })} />
          {L.coverOn && (
            <>
              <SegRow
                label="封面样式"
                value={L.coverStyle}
                options={[
                  { value: 'classic' as const, label: '经典' },
                  { value: 'editorial' as const, label: '杂志' },
                  { value: 'poster' as const, label: '海报' },
                  { value: 'jacket' as const, label: '书封' },
                  { value: 'index' as const, label: '索引' },
                ]}
                onChange={(v) => patch({ coverStyle: v })}
              />
              {L.coverStyle === 'classic' && (
                <SegRow
                  label="经典位置"
                  value={L.cover}
                  options={[
                    { value: 'top' as const, label: '上置' },
                    { value: 'center' as const, label: '居中' },
                    { value: 'bottom' as const, label: '下置' },
                  ]}
                  onChange={(v) => patch({ cover: v })}
                />
              )}
            </>
          )}
          <SliderRow label="上边距" value={L.padding.top} min={40} max={200} onChange={(v) => patch({ padding: { top: v } })} />
          <SliderRow label="下边距" value={L.padding.bottom} min={40} max={200} onChange={(v) => patch({ padding: { bottom: v } })} />
          <SliderRow label="左边距" value={L.padding.left} min={40} max={200} onChange={(v) => patch({ padding: { left: v } })} />
          <SliderRow label="右边距" value={L.padding.right} min={40} max={200} onChange={(v) => patch({ padding: { right: v } })} />
          <ToggleRow label="页眉话题标签" value={L.header.showTag} onChange={(v) => patch({ header: { showTag: v } })} />
          <ToggleRow label="页码（右下）" value={L.header.showPageNum} onChange={(v) => patch({ header: { showPageNum: v } })} />
          <SliderRow label="页眉高度" value={L.header.height} min={40} max={88} onChange={(v) => patch({ header: { height: v } })} />
        </Section>

        {/* 标题（分级） */}
        <Section title="标题样式" defaultOpen>
          <SegRow
            label="层级"
            value={headingTab}
            options={[
              { value: 'h2', label: 'H2' },
              { value: 'h3', label: 'H3' },
              { value: 'h4', label: 'H4+' },
            ]}
            onChange={setHeadingTab}
          />
          <SliderRow
            label="字号比" value={H.sizeRatio} min={0.9} max={2.6} step={0.05}
            suffix="×"
            onChange={(v) => patch({ headings: { [headingTab]: { sizeRatio: v } } as XhsStyleOverrides['headings'] })}
          />
          <SegRow
            label="字重" value={H.weight}
            options={[400, 500, 600, 700, 800].map((w) => ({ value: w, label: String(w) }))}
            onChange={(v) => patch({ headings: { [headingTab]: { weight: v } } as XhsStyleOverrides['headings'] })}
          />
          <SegRow
            label="装饰" value={H.decoration}
            options={[
              { value: 'none' as const, label: '无' },
              { value: 'bar' as const, label: '竖条' },
              { value: 'underline' as const, label: '下划线' },
            ]}
            onChange={(v) => patch({ headings: { [headingTab]: { decoration: v } } as XhsStyleOverrides['headings'] })}
          />
          <SegRow
            label="对齐" value={H.align}
            options={[
              { value: 'left' as const, label: '左' },
              { value: 'center' as const, label: '中' },
            ]}
            onChange={(v) => patch({ headings: { [headingTab]: { align: v } } as XhsStyleOverrides['headings'] })}
          />
          <SliderRow
            label="段前" value={H.spaceBefore} min={0} max={100}
            onChange={(v) => patch({ headings: { [headingTab]: { spaceBefore: v } } as XhsStyleOverrides['headings'] })}
          />
          <SliderRow
            label="段后" value={H.spaceAfter} min={0} max={50}
            onChange={(v) => patch({ headings: { [headingTab]: { spaceAfter: v } } as XhsStyleOverrides['headings'] })}
          />
        </Section>

        {/* 正文 */}
        <Section title="正文" defaultOpen>
          <SliderRow label="字号" value={L.body.size} min={26} max={54} suffix="px" onChange={(v) => patch({ body: { size: v } })} />
          <SliderRow label="行距" value={L.body.lineRatio} min={1.2} max={2.2} step={0.05} onChange={(v) => patch({ body: { lineRatio: v } })} />
          <SliderRow label="段距" value={L.body.paragraphSpacing} min={0} max={64} onChange={(v) => patch({ body: { paragraphSpacing: v } })} />
          <SliderRow label="字间距" value={L.body.letterSpacing} min={0} max={5} step={0.5} onChange={(v) => patch({ body: { letterSpacing: v } })} />
          <SegRow
            label="对齐" value={L.body.align}
            options={[
              { value: 'left' as const, label: '左' },
              { value: 'justify' as const, label: '两端' },
            ]}
            onChange={(v) => patch({ body: { align: v } })}
          />
        </Section>

        {/* 列表与引用 */}
        <Section title="列表 · 引用">
          <SliderRow label="列表缩进" value={L.list.indent} min={16} max={96} onChange={(v) => patch({ list: { indent: v } })} />
          <SliderRow label="条目间距" value={L.list.itemGap} min={0} max={40} onChange={(v) => patch({ list: { itemGap: v } })} />
          <SliderRow label="引用内边距" value={L.quote.pad} min={10} max={48} onChange={(v) => patch({ quote: { pad: v } })} />
          <SliderRow label="引用圆角" value={L.quote.radius} min={0} max={24} onChange={(v) => patch({ quote: { radius: v } })} />
          <SliderRow label="分隔线空隙" value={L.divider.gapY} min={0} max={64} onChange={(v) => patch({ divider: { gapY: v } })} />
        </Section>

        {/* 代码与表格 */}
        <Section title="代码 · 表格">
          <SliderRow label="代码字号比" value={L.code.sizeRatio} min={0.4} max={1.0} step={0.02} onChange={(v) => patch({ code: { sizeRatio: v } })} />
          <SliderRow label="代码内边距" value={L.code.pad} min={8} max={48} onChange={(v) => patch({ code: { pad: v } })} />
          <SliderRow label="代码圆角" value={L.code.radius} min={0} max={28} onChange={(v) => patch({ code: { radius: v } })} />
          <ToggleRow label="代码语言标签" value={L.code.showLang} onChange={(v) => patch({ code: { showLang: v } })} />
          <SliderRow label="表格字号比" value={L.table.sizeRatio} min={0.45} max={0.9} step={0.02} onChange={(v) => patch({ table: { sizeRatio: v } })} />
          <SliderRow label="单元格边距" value={L.table.cellPad} min={6} max={28} onChange={(v) => patch({ table: { cellPad: v } })} />
        </Section>

        {/* 图片 */}
        <Section title="图片">
          <ToggleRow label="通栏出血" value={L.image.fullBleed} onChange={(v) => patch({ image: { fullBleed: v } })} />
          <SliderRow label="圆角" value={L.image.radius} min={0} max={28} onChange={(v) => patch({ image: { radius: v } })} />
          <ToggleRow label="细描边" value={L.image.outline} onChange={(v) => patch({ image: { outline: v } })} />
          <SliderRow label="上下留白" value={L.image.marginY} min={0} max={48} onChange={(v) => patch({ image: { marginY: v } })} />
        </Section>

        {/* 水印 */}
        <Section title="水印">
          <ToggleRow label="显示水印" value={L.watermark.enabled} onChange={(v) => patch({ watermark: { enabled: v } })} />
          <SegRow
            label="位置" value={L.watermark.pos}
            options={[
              { value: 'left' as const, label: '左' },
              { value: 'center' as const, label: '中' },
              { value: 'right' as const, label: '右' },
            ]}
            onChange={(v) => patch({ watermark: { pos: v } })}
          />
          <input
            className="mt-1 w-full rounded-lg bg-black/[0.05] px-2.5 py-1.5 text-[12.5px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:bg-black/[0.08]"
            value={watermark}
            onChange={(e) => setWatermark(e.target.value)}
            placeholder="@你的账号"
          />
        </Section>
      </div>
    </aside>
  )
}
