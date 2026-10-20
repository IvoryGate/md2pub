import { useRef, useState, type ReactNode } from 'react'
import {
  XHS_THEMES,
  applyXhsOverrides,
  normalizeChromePos,
  type XhsLayout,
  type XhsStyleOverrides,
  type XhsCardTheme,
  type HeadingDecoration,
  type ChromePos,
  CLASSICAL_COLORS,
  paletteOf,
  derivePalette,
  contrastOf,
  type ColorScheme,
  type PaperTone,
  type PaletteTone,
} from '../platforms/xhs'
import { Check, ChevronDown, RotateCcw, SlidersHorizontal, Trash2, Plus, X, Undo2, Redo2 } from 'lucide-react'
import { useStore } from '../store'
import { hexToOklch, oklchToHex, rgbToHex, hexToRgb } from '../core/color'
import { useShallow } from 'zustand/react/shallow'

/**
 * 属性面板（Figma 式信息架构）：
 * - 三个顶层页签：基础 / 封面 / 高级，各管一域，互不干扰
 * - 基础只放高频调节；高级放分页策略、水印等低频/结构性设置
 * - 尺寸解耦：标题字号、封面标题字号一旦手动设置即为绝对值，不再随正文缩放
 * - 数值框可横向拖拽 scrub、↑↓ 微调；标签 10px / 行高 24px
 */

/* ---------- 控件 ---------- */

const Section = ({
  title,
  children,
  defaultOpen = false,
  inspectKey,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  inspectKey?: string
}) => {
  const [open, setOpen] = useState(defaultOpen)
  const setInspect = useStore((s) => s.setInspect)
  return (
    <section
      className="border-b border-black/[0.055] last:border-0"
      onMouseEnter={() => inspectKey && setInspect(inspectKey)}
      onMouseLeave={() => inspectKey && setInspect(null)}
    >
      <button className="flex h-8 w-full items-center gap-1.5 px-3 text-left" onClick={() => setOpen(!open)}>
        <ChevronDown className={`h-2.5 w-2.5 text-ink-faint transition-transform ${open ? '' : '-rotate-90'}`} strokeWidth={2.4} />
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

const fmt = (v: number, step: number) => (step < 0.05 ? v.toFixed(2) : step < 1 ? v.toFixed(1).replace(/\.0$/, '') : String(Math.round(v)))

const clampOf = (v: number, min: number, max: number, step: number) => Math.min(max, Math.max(min, Math.round(v / step) * step))

/** 数值输入：横向拖拽 scrub + 键盘 ↑↓ 微调 */
const Num = ({
  value, min, max, step = 1, suffix, onChange,
}: {
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (v: number) => void
}) => {
  const drag = useRef<{ x: number; v: number; moved: boolean } | null>(null)
  return (
    <span className="flex h-6 items-center rounded-md bg-black/[0.045] px-1.5 transition-colors focus-within:bg-white focus-within:ring-1 focus-within:ring-black/[0.14] hover:bg-black/[0.07]">
      <input
        className="w-full cursor-ew-resize bg-transparent text-[11px] tabular-nums text-ink outline-none"
        inputMode="decimal"
        value={fmt(value, step)}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isNaN(n)) onChange(clampOf(n, min, max, step))
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
          if (d.moved) onChange(clampOf(d.v + (dx / 90) * (max - min), min, max, step))
        }}
        onPointerUp={() => (drag.current = null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            onChange(clampOf(value + (e.key === 'ArrowUp' ? step : -step), min, max, step))
          }
        }}
      />
      {suffix && <span className="pointer-events-none ml-0.5 text-[9px] text-ink-faint">{suffix}</span>}
    </span>
  )
}

const Seg = <V extends string | number>({ value, options, onChange }: { value: V; options: Array<{ value: V; label: string }>; onChange: (v: V) => void }) => (
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
    <span className={`absolute top-[2px] h-[11px] w-[11px] rounded-full bg-white shadow-sm transition-all ${value ? 'left-[13px]' : 'left-[2px]'}`} />
  </button>
)

const ToggleRow = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
  <div className="mb-1.5 flex h-6 items-center justify-between last:mb-0">
    <span className="text-[10.5px] text-ink-soft">{label}</span>
    <Toggle value={value} onChange={onChange} />
  </div>
)

const TextInput = ({ value, placeholder, onChange, multiline }: { value: string; placeholder: string; onChange: (v: string) => void; multiline?: boolean }) => {
  const cls =
    'w-full rounded-md bg-black/[0.045] px-2 text-[11px] text-ink outline-none transition-colors placeholder:text-ink-faint hover:bg-black/[0.07] focus:bg-white focus:ring-1 focus:ring-black/[0.14]'
  return multiline ? (
    <textarea rows={2} className={`${cls} resize-none py-1.5 leading-relaxed`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  ) : (
    <input className={`${cls} h-6`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  )
}

const CHROME_LABEL: Record<ChromePos, string> = {
  'top-left': '左上',
  'top-center': '中上',
  'top-right': '右上',
  'bottom-left': '左下',
  'bottom-center': '中下',
  'bottom-right': '右下',
}

const PosGrid = ({ value, onChange }: { value: ChromePos; onChange: (v: ChromePos) => void }) => (
  <div className="grid grid-cols-3 gap-1">
    {(Object.keys(CHROME_LABEL) as ChromePos[]).map((p) => (
      <button
        key={p}
        onClick={() => onChange(p)}
        className={`h-6 rounded-[5px] text-[10px] transition-colors ${
          p === value ? 'bg-[#1d1d1f] font-medium text-white' : 'bg-black/[0.045] text-ink-soft hover:bg-black/[0.08]'
        }`}
      >
        {CHROME_LABEL[p]}
      </button>
    ))}
  </div>
)

/** HSV ↔ hex（色轮用 HSV；角色色板仍走 OKLCH 派生） */
const rgbToHsv = (r: number, g: number, b: number) => {
  const rr = r / 255, gg = g / 255, bb = b / 255
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb)
  const d = max - min
  let h = 0
  if (d) {
    if (max === rr) h = ((gg - bb) / d) % 6
    else if (max === gg) h = (bb - rr) / d + 2
    else h = (rr - gg) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max ? d / max : 0, v: max }
}
const hsvToHex = (h: number, s: number, v: number) => {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

const ColorWheel = ({ seed, onChange }: { seed: string; onChange: (hex: string) => void }) => {
  const [rgb] = [hexToRgb(seed)]
  const hsv = rgbToHsv(rgb[0], rgb[1], rgb[2])
  const ring = 126
  const sq = 126
  const pickRing = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    let h = (Math.atan2(dy, dx) * 180) / Math.PI + 90
    if (h < 0) h += 360
    onChange(hsvToHex(h, Math.max(0.15, hsv.s), Math.max(0.35, hsv.v)))
  }
  const pickSquare = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const v = Math.min(1, Math.max(0.15, 1 - (e.clientY - r.top) / r.height))
    onChange(hsvToHex(hsv.h, s, v))
  }
  return (
    <div className="flex items-center justify-center gap-3">
      <div
        className="relative shrink-0 cursor-crosshair rounded-full"
        style={{
          width: ring,
          height: ring,
          background: 'conic-gradient(from 90deg, #f43f5e, #f59e0b, #84cc16, #06b6d4, #3b82f6, #a855f7, #f43f5e)',
        }}
        onPointerDown={(e) => {
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          pickRing(e)
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) pickRing(e)
        }}
      >
        <div className="absolute inset-[18px] rounded-full bg-[#fcfcfa]" />
        <span
          className="absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full border-2 border-white shadow"
          style={{
            background: seed,
            transform: `translate(-50%,-50%) rotate(${hsv.h}deg) translateY(-${ring / 2 - 9}px)`,
          }}
        />
      </div>
      <div
        className="relative shrink-0 cursor-crosshair rounded-md ring-1 ring-black/10"
        style={{
          width: sq,
          height: sq,
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`,
        }}
        onPointerDown={(e) => {
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          pickSquare(e)
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) pickSquare(e)
        }}
      >
        <span
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: seed }}
        />
      </div>
    </div>
  )
}

const ColorRow = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="flex h-6 items-center gap-1.5">
    <span className="w-11 shrink-0 text-[10px] text-ink-soft">{label}</span>
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-5 w-5 shrink-0 cursor-pointer rounded-[4px] border border-black/[0.12] bg-transparent p-0"
    />
    <input
      className="h-6 min-w-0 flex-1 rounded-md bg-black/[0.045] px-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-soft outline-none focus:bg-white focus:ring-1 focus:ring-black/[0.14]"
      value={value.toUpperCase()}
      onChange={(e) => {
        if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value)
      }}
    />
  </div>
)

type HAlign = 'left' | 'center' | 'right'
/** 装饰成套：每种装饰声明适用的对齐方式，面板按当前对齐过滤 */
const DECORATIONS: Array<{ value: HeadingDecoration; label: string; aligns: HAlign[] }> = [
  { value: 'none', label: '无', aligns: ['left', 'center', 'right'] },
  { value: 'bar', label: '竖条', aligns: ['left'] },
  { value: 'twin', label: '双条', aligns: ['left'] },
  { value: 'dots', label: '尾点', aligns: ['left'] },
  { value: 'underline', label: '下划线', aligns: ['left', 'center', 'right'] },
  { value: 'pill', label: '胶囊', aligns: ['center'] },
  { value: 'flank', label: '双侧线', aligns: ['center'] },
  { value: 'bar-right', label: '右竖条', aligns: ['right'] },
]
const alignDefaultDeco = (a: HAlign): HeadingDecoration => (a === 'left' ? 'bar' : a === 'right' ? 'bar-right' : 'pill')

type TabKey = 'basic' | 'cover' | 'color' | 'advanced'

export const Sidebar = ({ baseTheme }: { baseTheme: XhsCardTheme }) => {
  const {
    themeId, setThemeId, overrides, patchLayout, resetOverrides,
    watermark, setWatermark, coverText, setCoverText,
    customPresets, savePreset, deletePreset, applyPreset,
    past, future, undoLayout, redoLayout, exportScale, setExportScale, exportFormat, setExportFormat,
    customCss, setCustomCss,
  } = useStore(
    useShallow((s) => ({
      themeId: s.themeId,
      setThemeId: s.setThemeId,
      overrides: s.overrides,
      patchLayout: s.patchLayout,
      resetOverrides: s.resetOverrides,
      watermark: s.watermark,
      setWatermark: s.setWatermark,
      coverText: s.coverText,
      setCoverText: s.setCoverText,
      customPresets: s.customPresets,
      savePreset: s.savePreset,
      deletePreset: s.deletePreset,
      applyPreset: s.applyPreset,
      past: s.past,
      future: s.future,
      undoLayout: s.undoLayout,
      redoLayout: s.redoLayout,
      exportScale: s.exportScale,
      setExportScale: s.setExportScale,
      exportFormat: s.exportFormat,
      setExportFormat: s.setExportFormat,
      customCss: s.customCss,
      setCustomCss: s.setCustomCss,
    })),
  )
  const theme = applyXhsOverrides(baseTheme, overrides)
  const L: XhsLayout = theme.layout
  const P = theme.palette
  const [tab, setTab] = useState<TabKey>('basic')
  const [headingTab, setHeadingTab] = useState<'h1' | 'h2' | 'h3' | 'h4'>('h2')
  const [presetName, setPresetName] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)
  const [seed, setSeed] = useState(P.accent)
  const [scheme, setScheme] = useState<ColorScheme>('analogous')
  const [paper, setPaper] = useState<PaperTone>('warm')
  const [tone, setTone] = useState<PaletteTone>(contrastOf(P.bg, '#000000') < 3 ? 'dark' : 'light')
  const applyColor = (s = seed, sc = scheme, pp = paper, tn = tone) => patch({ palette: derivePalette(s, sc, pp, tn) })
  const patch = (p: XhsStyleOverrides) => patchLayout(p)
  const H = L.headings[headingTab]

  const headingSize = H.size ?? Math.round(L.body.size * H.sizeRatio)
  const coverTitlePx = L.coverTitleSize ?? Math.round(L.body.size * 2.35)

  /** 拖正文只改正文：首次调整时把标题/封面标题的当前字号落定为绝对值 */
  const setBodySize = (v: number) => {
    const prev = L.body.size
    const frozen: Record<string, { size: number }> = {}
    for (const lvl of ['h1', 'h2', 'h3', 'h4'] as const) {
      const h = L.headings[lvl]
      if (h.size == null) frozen[lvl] = { size: Math.round(prev * h.sizeRatio) }
    }
    const next: XhsStyleOverrides = { body: { size: v } }
    if (Object.keys(frozen).length) next.headings = frozen as XhsStyleOverrides['headings']
    if (L.coverTitleSize == null) next.coverTitleSize = Math.round(prev * 2.35)
    patch(next)
  }

  /** 拖正文行距只改正文：首次调整时把标题行高落定 */
  const setBodyLineRatio = (v: number) => {
    const frozen: Record<string, { lineHeight: number }> = {}
    for (const lvl of ['h1', 'h2', 'h3', 'h4'] as const) {
      const h = L.headings[lvl]
      if (h.lineHeight == null) frozen[lvl] = { lineHeight: +(L.body.lineRatio * 0.82).toFixed(2) }
    }
    const next: XhsStyleOverrides = { body: { lineRatio: v } }
    if (Object.keys(frozen).length) next.headings = frozen as XhsStyleOverrides['headings']
    patch(next)
  }

  return (
    <aside className="absolute bottom-5 right-5 top-4 z-10 flex w-[336px] flex-col overflow-hidden rounded-[14px] border border-black/[0.07] bg-[#fcfcfa]/95 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      {/* 面板头 */}
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-black/[0.06] px-3">
        <SlidersHorizontal className="h-3 w-3 text-ink-faint" strokeWidth={1.9} />
        <span className="text-[11.5px] font-semibold tracking-[0.02em]">属性</span>
        <div className="flex-1" />
        <button
          className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-black/[0.06] hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          onClick={undoLayout}
          disabled={!past.length}
          title="撤销样式改动（Ctrl/Cmd+Z）"
        >
          <Undo2 className="h-3 w-3" strokeWidth={2} />
        </button>
        <button
          className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-black/[0.06] hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          onClick={redoLayout}
          disabled={!future.length}
          title="重做（Shift+Ctrl/Cmd+Z）"
        >
          <Redo2 className="h-3 w-3" strokeWidth={2} />
        </button>
        <button
          className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-black/[0.06] hover:text-ink"
          onClick={resetOverrides}
          title="重置为当前预设的默认值"
        >
          <RotateCcw className="h-3 w-3" strokeWidth={2} />
        </button>
      </div>

      {/* 页签：基础 / 封面 / 高级 */}
      <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-black/[0.06] px-2">
        {(
          [
            ['basic', '基础'],
            ['cover', '封面'],
            ['color', '颜色'],
            ['advanced', '高级'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`h-6 flex-1 rounded-[5px] text-[10.5px] transition-colors ${
              tab === k ? 'bg-white font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div key={tab} className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'basic' && (
          <>
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

              {customPresets.length > 0 && (
                <div className="mt-1.5 grid gap-1">
                  {customPresets.map((p) => (
                    <div key={p.id} className="group flex h-7 items-center gap-1 rounded-md border border-transparent px-1.5 hover:border-black/[0.08] hover:bg-black/[0.03]">
                      <button className="flex flex-1 items-center gap-1.5 text-left" onClick={() => applyPreset(p.id)} title="应用此预设">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent/70" />
                        <span className="truncate text-[10.5px] text-ink-soft group-hover:text-ink">{p.name}</span>
                      </button>
                      <button
                        className="flex h-5 w-5 items-center justify-center rounded text-ink-faint opacity-0 transition-opacity hover:bg-black/[0.06] hover:text-ink group-hover:opacity-100"
                        onClick={() => deletePreset(p.id)}
                        title="删除"
                      >
                        <Trash2 className="h-2.5 w-2.5" strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {savingPreset ? (
                <div className="mt-1.5 flex items-center gap-1">
                  <input
                    autoFocus
                    className="h-6 min-w-0 flex-1 rounded-md bg-black/[0.045] px-2 text-[10.5px] text-ink outline-none placeholder:text-ink-faint focus:bg-white focus:ring-1 focus:ring-black/[0.14]"
                    placeholder="预设名称"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        savePreset(presetName)
                        setPresetName('')
                        setSavingPreset(false)
                      }
                      if (e.key === 'Escape') setSavingPreset(false)
                    }}
                  />
                  <button
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1d1d1f] text-white"
                    onClick={() => {
                      savePreset(presetName)
                      setPresetName('')
                      setSavingPreset(false)
                    }}
                    title="保存"
                  >
                    <Check className="h-3 w-3" strokeWidth={2.4} />
                  </button>
                  <button
                    className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint hover:bg-black/[0.06]"
                    onClick={() => setSavingPreset(false)}
                    title="取消"
                  >
                    <X className="h-3 w-3" strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <button
                  className="mt-1.5 flex h-6 w-full items-center justify-center gap-1 rounded-md border border-dashed border-black/[0.14] text-[10px] text-ink-soft transition-colors hover:border-black/[0.24] hover:text-ink"
                  onClick={() => setSavingPreset(true)}
                >
                  <Plus className="h-2.5 w-2.5" strokeWidth={2.2} />
                  保存当前样式为预设
                </button>
              )}
            </Section>

            {/* 正文 */}
            <Section title="正文" defaultOpen>
              <Pair>
                <Field label="字号">
                  <Num value={L.body.size} min={26} max={54} suffix="px" onChange={setBodySize} />
                </Field>
                <Field label="行距">
                  <Num value={L.body.lineRatio} min={1.2} max={2.2} step={0.05} suffix="×" onChange={setBodyLineRatio} />
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
                  <Field label="字号">
                    <Num value={headingSize} min={20} max={120} suffix="px" onChange={(v) => patch({ headings: { [headingTab]: { size: v } } as XhsStyleOverrides['headings'] })} />
                  </Field>
                  <Field label="行距">
                    <Num
                      value={H.lineHeight ?? +(L.body.lineRatio * 0.82).toFixed(2)}
                      min={1}
                      max={2.2}
                      step={0.05}
                      suffix="×"
                      onChange={(v) => patch({ headings: { [headingTab]: { lineHeight: v } } as XhsStyleOverrides['headings'] })}
                    />
                  </Field>
                </Pair>
                <Pair>
                  <Field label="字距">
                    <Num value={H.tracking ?? L.body.letterSpacing} min={0} max={8} step={0.5} suffix="px" onChange={(v) => patch({ headings: { [headingTab]: { tracking: v } } as XhsStyleOverrides['headings'] })} />
                  </Field>
                  <Field label="字重">
                    <Seg value={H.weight} options={[500, 600, 700, 800].map((w) => ({ value: w, label: String(w) }))} onChange={(v) => patch({ headings: { [headingTab]: { weight: v } } as XhsStyleOverrides['headings'] })} />
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
                <div className="mt-1.5">
                  <Field label="装饰">
                    <div className="grid grid-cols-3 gap-1">
                      {DECORATIONS.filter((d) => d.aligns.includes(H.align as HAlign)).map((d) => (
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
                        { value: 'right' as const, label: '右' },
                      ]}
                      onChange={(v) => {
                        const valid = DECORATIONS.filter((d) => d.aligns.includes(v)).map((d) => d.value)
                        const deco = valid.includes(H.decoration) ? H.decoration : alignDefaultDeco(v)
                        patch({ headings: { [headingTab]: { align: v, decoration: deco } } as XhsStyleOverrides['headings'] })
                      }}
                    />
                  </Field>
                </div>
              </div>
            </Section>

            {/* 页面 */}
            <Section title="页面" inspectKey="padding">
              <Pair>
                <Field label="上边距">
                  <Num value={L.padding.top} min={40} max={200} suffix="px" onChange={(v) => patch({ padding: { top: v } })} />
                </Field>
                <Field label="下边距">
                  <Num value={L.padding.bottom} min={40} max={200} suffix="px" onChange={(v) => patch({ padding: { bottom: v } })} />
                </Field>
              </Pair>
              <Pair>
                <Field label="左边距">
                  <Num value={L.padding.left} min={40} max={200} suffix="px" onChange={(v) => patch({ padding: { left: v } })} />
                </Field>
                <Field label="右边距">
                  <Num value={L.padding.right} min={40} max={200} suffix="px" onChange={(v) => patch({ padding: { right: v } })} />
                </Field>
              </Pair>
            </Section>

            <Section title="页眉页脚" defaultOpen inspectKey="header">
              <Pair>
                <Field label="话题标签">
                  <Seg
                    value={L.header.showTag ? 'on' : 'off'}
                    options={[
                      { value: 'on' as const, label: '显示' },
                      { value: 'off' as const, label: '隐藏' },
                    ]}
                    onChange={(v) => patch({ header: { showTag: v === 'on' } })}
                  />
                </Field>
                <Field label="页码">
                  <Seg
                    value={L.header.showPageNum ? 'on' : 'off'}
                    options={[
                      { value: 'on' as const, label: '显示' },
                      { value: 'off' as const, label: '隐藏' },
                    ]}
                    onChange={(v) => patch({ header: { showPageNum: v === 'on' } })}
                  />
                </Field>
              </Pair>
              {L.header.showTag && (
                <>
                  <Field label="标签位置">
                    <PosGrid value={normalizeChromePos(L.header.tagPos ?? 'top-left')} onChange={(v) => patch({ header: { tagPos: v } })} />
                  </Field>
                  <div className="mt-1.5">
                    <Pair>
                      <Field label="字号">
                        <Num value={L.header.tagSize ?? 28} min={16} max={48} suffix="px" onChange={(v) => patch({ header: { tagSize: v } })} />
                      </Field>
                      <Field label="字距">
                        <Num value={L.header.tagTracking ?? 5} min={0} max={14} step={0.5} suffix="px" onChange={(v) => patch({ header: { tagTracking: v } })} />
                      </Field>
                    </Pair>
                    <Field label="透明度">
                      <Num value={L.header.tagOpacity ?? 1} min={0.2} max={1} step={0.05} onChange={(v) => patch({ header: { tagOpacity: v } })} />
                    </Field>
                  </div>
                </>
              )}
              {L.header.showPageNum && (
                <>
                  <Field label="页码位置">
                    <PosGrid value={normalizeChromePos(L.header.pageNumPos)} onChange={(v) => patch({ header: { pageNumPos: v } })} />
                  </Field>
                  <div className="mt-1.5">
                    <Pair>
                      <Field label="字号">
                        <Num value={L.header.pageSize ?? 26} min={16} max={40} suffix="px" onChange={(v) => patch({ header: { pageSize: v } })} />
                      </Field>
                      <Field label="字距">
                        <Num value={L.header.pageTracking ?? 2} min={0} max={12} step={0.5} suffix="px" onChange={(v) => patch({ header: { pageTracking: v } })} />
                      </Field>
                    </Pair>
                    <Field label="透明度">
                      <Num value={L.header.pageOpacity ?? 0.85} min={0.2} max={1} step={0.05} onChange={(v) => patch({ header: { pageOpacity: v } })} />
                    </Field>
                  </div>
                </>
              )}
            </Section>

            <Section title="水印" defaultOpen inspectKey="watermark">
              <ToggleRow label="显示水印" value={L.watermark.enabled} onChange={(v) => patch({ watermark: { enabled: v } })} />
              <Field label="位置">
                <PosGrid value={normalizeChromePos(L.watermark.pos)} onChange={(v) => patch({ watermark: { pos: v } })} />
              </Field>
              <div className="mt-1.5">
                <Pair>
                  <Field label="字号">
                    <Num value={L.watermark.size ?? 26} min={14} max={48} suffix="px" onChange={(v) => patch({ watermark: { size: v } })} />
                  </Field>
                  <Field label="字距">
                    <Num value={L.watermark.tracking ?? 1} min={0} max={12} step={0.5} suffix="px" onChange={(v) => patch({ watermark: { tracking: v } })} />
                  </Field>
                </Pair>
                <Field label="透明度">
                  <Num value={L.watermark.opacity ?? 0.72} min={0.15} max={1} step={0.05} onChange={(v) => patch({ watermark: { opacity: v } })} />
                </Field>
                <Field label="文案">
                  <TextInput value={watermark} placeholder="@你的账号" onChange={setWatermark} />
                </Field>
              </div>
            </Section>

            <Section title="列表">
              <Pair>
                <Field label="条目间距">
                  <Num value={L.list.itemGap} min={0} max={40} suffix="px" onChange={(v) => patch({ list: { itemGap: v } })} />
                </Field>
                <Field label="分隔线空隙">
                  <Num value={L.divider.gapY} min={0} max={64} suffix="px" onChange={(v) => patch({ divider: { gapY: v } })} />
                </Field>
              </Pair>
            </Section>

            <Section title="引用">
              <Pair>
                <Field label="内边距">
                  <Num value={L.quote.pad} min={10} max={48} suffix="px" onChange={(v) => patch({ quote: { pad: v } })} />
                </Field>
                <Field label="圆角">
                  <Num value={L.quote.radius} min={0} max={24} suffix="px" onChange={(v) => patch({ quote: { radius: v } })} />
                </Field>
              </Pair>
            </Section>

            <Section title="代码">
              <Pair>
                <Field label="字号比">
                  <Num value={L.code.sizeRatio} min={0.4} max={1.0} step={0.02} suffix="×" onChange={(v) => patch({ code: { sizeRatio: v } })} />
                </Field>
                <Field label="内边距">
                  <Num value={L.code.pad} min={8} max={48} suffix="px" onChange={(v) => patch({ code: { pad: v } })} />
                </Field>
              </Pair>
              <Pair>
                <Field label="圆角">
                  <Num value={L.code.radius} min={0} max={28} suffix="px" onChange={(v) => patch({ code: { radius: v } })} />
                </Field>
                <Field label="块前后留白">
                  <Num value={L.blocks.marginY} min={0} max={48} suffix="px" onChange={(v) => patch({ blocks: { marginY: v } })} />
                </Field>
              </Pair>
              <ToggleRow label="语言标签" value={L.code.showLang} onChange={(v) => patch({ code: { showLang: v } })} />
            </Section>

            <Section title="表格">
              <Pair>
                <Field label="字号比">
                  <Num value={L.table.sizeRatio} min={0.45} max={0.9} step={0.02} suffix="×" onChange={(v) => patch({ table: { sizeRatio: v } })} />
                </Field>
                <Field label="单元格边距">
                  <Num value={L.table.cellPad} min={6} max={28} suffix="px" onChange={(v) => patch({ table: { cellPad: v } })} />
                </Field>
              </Pair>
            </Section>

            <Section title="图片">
              <Pair>
                <Field label="圆角">
                  <Num value={L.image.radius} min={0} max={28} suffix="px" onChange={(v) => patch({ image: { radius: v } })} />
                </Field>
                <Field label="上下留白">
                  <Num value={L.image.marginY} min={0} max={48} suffix="px" onChange={(v) => patch({ image: { marginY: v } })} />
                </Field>
              </Pair>
              <ToggleRow label="通栏出血" value={L.image.fullBleed} onChange={(v) => patch({ image: { fullBleed: v } })} />
              <ToggleRow label="细描边" value={L.image.outline} onChange={(v) => patch({ image: { outline: v } })} />
            </Section>
          </>
        )}

        {tab === 'cover' && (
          <>
            <Section title="封面" defaultOpen inspectKey="cover">
              <ToggleRow label="显示封面" value={L.coverOn} onChange={(v) => patch({ coverOn: v })} />
              {L.coverOn && (
                <div className="mt-1.5 space-y-1.5">
                  <Field label="标题">
                    <TextInput value={coverText.title} placeholder="封面标题" multiline onChange={(v) => setCoverText({ title: v })} />
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
                        <Num value={coverTitlePx} min={40} max={180} suffix="px" onChange={(v) => patch({ coverTitleSize: v })} />
                      </Field>
                    </Pair>
                  ) : (
                    <div className="w-1/2 pr-[3px]">
                      <Field label="标题字号">
                        <Num value={coverTitlePx} min={40} max={180} suffix="px" onChange={(v) => patch({ coverTitleSize: v })} />
                      </Field>
                    </div>
                  )}
                </div>
              )}
            </Section>

            <Section title="封面水印" defaultOpen>
              <ToggleRow label="显示水印" value={L.watermark.cover} onChange={(v) => patch({ watermark: { cover: v } })} />
              <Field label="位置">
                <PosGrid value={normalizeChromePos(L.watermark.coverPos)} onChange={(v) => patch({ watermark: { coverPos: v } })} />
              </Field>
              <div className="mt-1.5">
                <Field label="文案（共用）">
                  <TextInput value={watermark} placeholder="@你的账号" onChange={setWatermark} />
                </Field>
              </div>
            </Section>
          </>
        )}

        {tab === 'color' && (
          <>
            <Section title="古典配色" defaultOpen>
              <div className="grid grid-cols-2 gap-1">
                {CLASSICAL_COLORS.map((preset) => {
                  const pal = paletteOf(preset)
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setSeed(preset.seed)
                        setScheme(preset.scheme)
                        setPaper(preset.paper)
                        patch({ palette: paletteOf(preset, tone) })
                      }}
                      className="flex h-8 items-center gap-1.5 rounded-md border border-transparent px-1.5 text-left transition-colors hover:border-black/[0.08] hover:bg-black/[0.03]"
                    >
                      <span className="flex shrink-0 -space-x-1">
                        {[pal.bg, pal.accent, pal.strong].map((c, i) => (
                          <i key={i} className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                        ))}
                      </span>
                      <span className="truncate text-[10.5px] text-ink-soft">{preset.name}</span>
                    </button>
                  )
                })}
              </div>
            </Section>

            <Section title="配色关系" defaultOpen>
              <Field label="主色（种子）">
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={seed}
                    onChange={(e) => {
                      setSeed(e.target.value)
                      applyColor(e.target.value)
                    }}
                    className="h-6 w-6 cursor-pointer rounded-[4px] border border-black/[0.12] bg-transparent p-0"
                  />
                  <input
                    className="h-6 min-w-0 flex-1 rounded-md bg-black/[0.045] px-2 font-mono text-[10.5px] uppercase text-ink outline-none focus:bg-white focus:ring-1 focus:ring-black/[0.14]"
                    value={seed.toUpperCase()}
                    onChange={(e) => {
                      if (/^#[0-9a-f]{6}$/i.test(e.target.value)) {
                        setSeed(e.target.value)
                        applyColor(e.target.value)
                      }
                    }}
                  />
                </div>
              </Field>
              <div className="mt-1.5">
                <Field label="色相关系">
                  <Seg
                    value={scheme}
                    options={[
                      { value: 'mono' as const, label: '单色' },
                      { value: 'analogous' as const, label: '类似' },
                      { value: 'complement' as const, label: '互补' },
                      { value: 'split' as const, label: '分裂' },
                      { value: 'triadic' as const, label: '三分' },
                    ]}
                    onChange={(v) => {
                      setScheme(v)
                      applyColor(seed, v)
                    }}
                  />
                </Field>
              </div>
              <div className="mt-1.5">
                <Field label="纸色温度">
                  <Seg
                    value={paper}
                    options={[
                      { value: 'warm' as const, label: '暖纸' },
                      { value: 'cool' as const, label: '冷纸' },
                    ]}
                    onChange={(v) => {
                      setPaper(v)
                      applyColor(seed, scheme, v)
                    }}
                  />
                </Field>
              </div>
              <div className="mt-1.5">
                <Field label="明暗">
                  <Seg
                    value={tone}
                    options={[
                      { value: 'light' as const, label: '浅色' },
                      { value: 'dark' as const, label: '深色' },
                    ]}
                    onChange={(v) => {
                      setTone(v)
                      applyColor(seed, scheme, paper, v)
                    }}
                  />
                </Field>
              </div>
              <div className="mt-2">
                <Field label="色轮">
                  <ColorWheel
                    seed={seed}
                    onChange={(hex) => {
                      setSeed(hex)
                      applyColor(hex)
                    }}
                  />
                </Field>
              </div>
              <div className="mt-1.5">
                <ToggleRow label="纸面颗粒" value={L.paperTexture} onChange={(v) => patch({ paperTexture: v })} />
                {L.paperTexture && (
                  <div className="mt-1 grid grid-cols-2 items-end gap-1.5">
                    <Field label="颗粒强度">
                      <Num value={L.paperTextureStrength ?? 5} min={1} max={10} suffix="/10" onChange={(v) => patch({ paperTextureStrength: Math.round(v) })} />
                    </Field>
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-[9px] leading-relaxed text-ink-faint">
                色轮定关系（OKLCH 等感知步长）；明度建层级、彩度反向补偿；文字对比度自动校验。
              </p>
            </Section>

            <Section title="中性色" defaultOpen>
              <div className="flex overflow-hidden rounded-md ring-1 ring-black/[0.08]">
                {[0.97, 0.9, 0.8, 0.65, 0.45, 0.3, 0.2].map((l) => {
                  const hex = oklchToHex(l, 0.012, hexToOklch(P.accent).h)
                  return <div key={l} className="h-8 flex-1" style={{ background: hex }} title={`${hex.toUpperCase()} · L ${l}`} />
                })}
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-ink-faint">
                <span>纸色</span>
                <span>浅灰</span>
                <span>中灰</span>
                <span>墨色</span>
              </div>
              <p className="mt-1 text-[9px] leading-relaxed text-ink-faint">沿种子色相自动派生，供正文/次要文字与分隔线使用。</p>
            </Section>

            <Section title="角色色" defaultOpen>
              <div className="space-y-1">
                <ColorRow label="纸色" value={P.bg} onChange={(v) => patch({ palette: { bg: v } })} />
                <ColorRow label="正文" value={P.text} onChange={(v) => patch({ palette: { text: v } })} />
                <ColorRow label="标题" value={P.heading} onChange={(v) => patch({ palette: { heading: v } })} />
                <ColorRow label="次要" value={P.muted} onChange={(v) => patch({ palette: { muted: v } })} />
                <ColorRow label="强调" value={P.accent} onChange={(v) => patch({ palette: { accent: v } })} />
                <ColorRow label="加粗" value={P.strong} onChange={(v) => patch({ palette: { strong: v } })} />
                <ColorRow label="斜体" value={P.italic} onChange={(v) => patch({ palette: { italic: v } })} />
                <ColorRow label="引用底" value={P.quoteBg} onChange={(v) => patch({ palette: { quoteBg: v } })} />
                <ColorRow label="代码底" value={P.codeBg} onChange={(v) => patch({ palette: { codeBg: v } })} />
                <ColorRow label="代码字" value={P.codeFg} onChange={(v) => patch({ palette: { codeFg: v } })} />
              </div>
              <button
                className="mt-2 flex h-6 w-full items-center justify-center rounded-md border border-dashed border-black/[0.14] text-[10px] text-ink-soft transition-colors hover:border-black/[0.24] hover:text-ink"
                onClick={() => patch({ palette: undefined })}
              >
                恢复主题配色
              </button>
            </Section>

            <Section title="可读性" defaultOpen>
              {(
                [
                  ['正文 / 纸', P.text, P.bg, 4.5],
                  ['标题 / 纸', P.heading, P.bg, 4.5],
                  ['强调 / 纸', P.accent, P.bg, 3],
                  ['次要 / 纸', P.muted, P.bg, 3],
                ] as Array<[string, string, string, number]>
              ).map(([label, fg, bg, need]) => {
                const ratio = contrastOf(fg, bg)
                const ok = ratio >= need
                return (
                  <div key={label} className="flex h-6 items-center justify-between text-[10.5px]">
                    <span className="text-ink-soft">{label}</span>
                    <span className={ok ? 'font-medium text-[#3a7d44]' : 'font-medium text-[#b45309]'}>
                      {ratio.toFixed(1)}:1 {ok ? 'AA' : '偏低'}
                    </span>
                  </div>
                )
              })}
            </Section>
          </>
        )}

        {tab === 'advanced' && (
          <>
            <Section title="导出" defaultOpen>
              <Pair>
                <Field label="倍率">
                  <Seg
                    value={exportScale}
                    options={[
                      { value: 1 as const, label: '1×' },
                      { value: 2 as const, label: '2×' },
                      { value: 3 as const, label: '3×' },
                    ]}
                    onChange={(v) => setExportScale(v as 1 | 2 | 3)}
                  />
                </Field>
                <Field label="格式">
                  <Seg
                    value={exportFormat}
                    options={[
                      { value: 'png' as const, label: 'PNG' },
                      { value: 'jpg' as const, label: 'JPG' },
                    ]}
                    onChange={setExportFormat}
                  />
                </Field>
              </Pair>
              <p className="text-[9px] leading-relaxed text-ink-faint">
                1× 适合快速预览，2× 为推荐清晰度（2160×2880），3× 文件较大。
              </p>
            </Section>

            <Section title="自定义 CSS" defaultOpen={false}>
              <p className="mb-1.5 text-[9px] leading-relaxed text-ink-faint">
                直接注入样式（作用于整个页面；谨慎使用）。例如：<br />
                <code>[data-xhs-theme] em {'{'} letter-spacing: 0.04em {'}'}</code>
              </p>
              <textarea
                rows={6}
                className="w-full resize-y rounded-md bg-black/[0.045] px-2 py-1.5 font-mono text-[10px] leading-relaxed text-ink outline-none focus:bg-white focus:ring-1 focus:ring-black/[0.14]"
                placeholder="/* 自定义 CSS */"
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
              />
            </Section>

            <Section title="自动排版" defaultOpen>
              <Field label="分页策略">
                <Seg
                  value={L.pagination}
                  options={[
                    { value: 'optimal' as const, label: '全局最优' },
                    { value: 'greedy' as const, label: '顺序贪心' },
                  ]}
                  onChange={(v) => patch({ pagination: v })}
                />
              </Field>
              <p className="mt-1.5 text-[9px] leading-relaxed text-ink-faint">
                全局最优：全篇断点一起求解，页尾留白最均衡；顺序贪心：逐块填满，行为更可预测。
              </p>
            </Section>

          </>
        )}
      </div>
    </aside>
  )
}
