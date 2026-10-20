import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Image as ImageIcon, LayoutGrid, X } from 'lucide-react'
import { applyXhsOverrides, getTheme, type XhsCardTheme } from '../platforms/xhs'
import { COVER_TEMPLATES, STYLE_PRESETS, resolvePreset, type GalleryPreset } from '../content/gallery'

const titleText = '把复杂的事\n讲清楚'

/* ---------- 缩略预览 ---------- */

const MiniContent = ({ theme }: { theme: XhsCardTheme }) => {
  const p = theme.palette
  const line = (w: number, op = 0.14) => (
    <div style={{ height: 2.5, width: `${w}%`, borderRadius: 2, background: p.text, opacity: op }} />
  )
  return (
    <div
      style={{
        aspectRatio: '3 / 4',
        background: p.bg,
        borderRadius: 8,
        padding: '12px 11px',
        boxSizing: 'border-box',
        fontFamily: theme.fontFamily,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ fontSize: 5.5, letterSpacing: 1, color: p.accent, fontWeight: 700 }}># 写作 #</div>
      <div style={{ marginTop: 9, fontSize: 13, lineHeight: 1.2, fontWeight: 800, color: p.heading, whiteSpace: 'pre-line' }}>
        {titleText}
      </div>
      <div style={{ width: 26, height: 2.5, borderRadius: 2, background: p.accent, marginTop: 6 }} />
      <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 4.5 }}>
        {line(100)}
        {line(92)}
        {line(96)}
        {line(72)}
      </div>
      <div style={{ marginTop: 8, padding: '5px 6px', borderLeft: `2px solid ${p.accent}`, background: p.quoteBg }}>
        <div style={{ height: 2.5, width: '80%', borderRadius: 2, background: p.text, opacity: 0.26 }} />
        <div style={{ height: 2.5, width: '58%', borderRadius: 2, background: p.text, opacity: 0.26, marginTop: 3 }} />
      </div>
      <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 3 }}>
        <span style={{ width: 2, height: 7, borderRadius: 1, background: p.accent }} />
        <span style={{ fontSize: 7, fontWeight: 700, color: p.heading }}>三种结构</span>
      </div>
      <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 3.5 }}>
        {line(94)}
        {line(86)}
        {line(68)}
      </div>
      <div style={{ marginTop: 4, fontSize: 5.5, color: p.text, opacity: 0.5, letterSpacing: 0.2 }}>
        01 教程型　02 复盘型　03 清单型
      </div>
      <div
        style={{
          position: 'absolute',
          left: 11,
          right: 11,
          bottom: 9,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 5,
          color: p.muted,
          letterSpacing: 0.4,
        }}
      >
        <span>IvoryGate</span>
        <span>01 / 08</span>
      </div>
    </div>
  )
}

const MiniCover = ({ theme }: { theme: XhsCardTheme }) => {
  const p = theme.palette
  const L = theme.layout
  const style = L.coverStyle
  const base: React.CSSProperties = {
    aspectRatio: '3 / 4',
    background: p.bg,
    borderRadius: 8,
    padding: '12px 11px',
    boxSizing: 'border-box',
    fontFamily: theme.fontFamily,
    overflow: 'hidden',
    position: 'relative',
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
  }
  const tag = <div style={{ fontSize: 5.5, letterSpacing: 1.2, color: p.accent, fontWeight: 700 }}># 写作 #</div>
  const author = <div style={{ fontSize: 5.5, color: p.text, opacity: 0.62, letterSpacing: 0.6 }}>IvoryGate</div>
  const bar = <div style={{ width: 26, height: 2.5, borderRadius: 2, background: p.accent }} />
  const title = (size: number, align: 'left' | 'center' = 'left') => (
    <div
      style={{
        fontSize: size,
        lineHeight: 1.16,
        fontWeight: 800,
        letterSpacing: 0.2,
        color: p.heading,
        textAlign: align,
        whiteSpace: 'pre-line',
      }}
    >
      {titleText}
    </div>
  )

  if (style === 'vertical') {
    return (
      <div style={base}>
        <div
          style={{
            position: 'absolute',
            right: 11,
            top: 12,
            bottom: 12,
            writingMode: 'vertical-rl',
            fontSize: 14,
            lineHeight: 1.25,
            fontWeight: 700,
            letterSpacing: 2,
            color: p.heading,
          }}
        >
          {titleText.replace('\n', '')}
        </div>
        <div
          style={{
            position: 'absolute',
            right: 36,
            top: 12,
            writingMode: 'vertical-rl',
            fontSize: 5.5,
            letterSpacing: 1.4,
            color: p.accent,
          }}
        >
          #写作# #排版# #内容设计#
        </div>
        <div style={{ position: 'absolute', left: 11, bottom: 9 }}>{author}</div>
        <div style={{ position: 'absolute', right: 12, bottom: 12, width: 10, height: 10, borderRadius: 2, background: p.accent }} />
      </div>
    )
  }

  if (style === 'big') {
    return (
      <div style={base}>
        {tag}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>{title(23)}</div>
        <div style={{ height: 1, background: `${p.text}26`, marginBottom: 6 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          {author}
          <span style={{ fontSize: 5.5, color: p.text, opacity: 0.55 }}>一份结构清单</span>
        </div>
      </div>
    )
  }

  if (style === 'editorial') {
    return (
      <div style={base}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>{tag}{author}</div>
        <div style={{ height: 1, background: `${p.text}24`, marginTop: 7 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7 }}>
          {title(18)}
          {bar}
          <div style={{ fontSize: 6, color: p.text, opacity: 0.55, letterSpacing: 0.4 }}>一份内容卡片的结构清单</div>
        </div>
        <div style={{ height: 1, background: `${p.text}24`, marginBottom: 6 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 5, color: p.muted }}>
          <span>MD2PUB</span><span>01</span>
        </div>
      </div>
    )
  }

  if (style === 'jacket') {
    return (
      <div style={{ ...base, padding: 10 }}>
        <div
          style={{
            flex: 1,
            border: `1px solid ${p.accent}55`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '10px 7px 8px',
          }}
        >
          {tag}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', textAlign: 'center' }}>{title(16, 'center')}</div>
          <div style={{ width: 18, height: 2, background: `${p.accent}88`, marginBottom: 5 }} />
          {author}
        </div>
      </div>
    )
  }

  if (style === 'index') {
    return (
      <div style={base}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 5.5, letterSpacing: 1.6, color: p.accent }}>
          <span>目录</span>
          {author}
        </div>
        <div style={{ height: 1, background: `${p.text}24`, marginTop: 6 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 }}>
          {title(17)}
          <div style={{ fontSize: 6, color: p.text, opacity: 0.55 }}>一份内容卡片的结构清单</div>
          <div style={{ marginTop: 6 }}>
            {['写作', '排版', '内容设计'].map((t, i) => (
              <div
                key={t}
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'baseline',
                  padding: '4px 0',
                  borderTop: `1px solid ${p.text}1a`,
                  fontSize: 5.5,
                  color: p.text,
                  opacity: 0.65,
                }}
              >
                <span style={{ color: p.accent, fontSize: 5 }}>{String(i + 1).padStart(2, '0')}</span>
                {t}
              </div>
            ))}
          </div>
        </div>
        {bar}
      </div>
    )
  }

  return (
    <div style={{ ...base, alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center' }}>
      {tag}
      {title(17, 'center')}
      <div style={{ fontSize: 6, color: p.text, opacity: 0.55 }}>一份内容卡片的结构清单</div>
      {bar}
      {author}
    </div>
  )
}

/* ---------- 画廊 ---------- */

export const Gallery = ({
  open,
  initialTab,
  onClose,
  onApply,
}: {
  open: boolean
  initialTab: 'style' | 'cover'
  onClose: () => void
  onApply: (preset: GalleryPreset) => void
}) => {
  const [tab, setTab] = useState<'style' | 'cover'>(initialTab)

  useEffect(() => {
    if (open) setTab(initialTab)
  }, [open, initialTab])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const list = tab === 'style' ? STYLE_PRESETS : COVER_TEMPLATES

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" />
      <div
        className="relative flex max-h-[84vh] w-[780px] max-w-full flex-col overflow-hidden rounded-[20px] border border-white/50 bg-[#fcfcfa] shadow-[0_30px_90px_-24px_rgba(0,0,0,0.55)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-black/[0.06] px-5 pb-3 pt-4">
          <div>
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-ink-soft" strokeWidth={1.8} />
              <span className="text-[14px] font-semibold tracking-[-0.01em]">预设画廊</span>
            </div>
            <p className="mt-1 text-[10.5px] text-ink-faint">风格只改版式与配色，不动正文；封面模板会保留你已填的封面文案。</p>
          </div>
          <button
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-black/[0.06] hover:text-ink"
            onClick={onClose}
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1 border-b border-black/[0.06] px-5 py-2">
          {(
            [
              ['style', '风格', STYLE_PRESETS.length],
              ['cover', '封面模板', COVER_TEMPLATES.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex h-7 items-center gap-1.5 rounded-full px-3 text-[11px] transition-colors ${
                tab === key ? 'bg-ink font-medium text-white' : 'text-ink-soft hover:bg-black/[0.05]'
              }`}
            >
              {key === 'cover' ? <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.8} /> : <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.8} />}
              {label}
              <span className={`${tab === key ? 'text-white/55' : 'text-ink-faint'} text-[9.5px]`}>{count}</span>
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-[9.5px] text-ink-faint">点击任意一张应用</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4">
          <div className="grid grid-cols-3 gap-x-4 gap-y-5">
            {list.map((preset) => {
              const theme = applyXhsOverrides(getTheme(preset.themeId), resolvePreset(preset))
              return (
                <button key={preset.id} className="group min-w-0 text-left" onClick={() => onApply(preset)}>
                  <div className="rounded-[13px] border border-black/[0.07] bg-white p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all group-hover:-translate-y-0.5 group-hover:shadow-[0_14px_30px_-16px_rgba(0,0,0,0.25)]">
                    {preset.kind === 'cover' ? <MiniCover theme={theme} /> : <MiniContent theme={theme} />}
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="truncate text-[11px] font-medium text-ink">{preset.name}</span>
                    {preset.colorId && (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: theme.palette.accent }}
                      />
                    )}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-ink-faint">{preset.note}</div>
                </button>
              )
            })}
          </div>
          {tab === 'cover' && (
            <p className="mt-5 rounded-lg bg-black/[0.03] px-3 py-2 text-[9.5px] leading-relaxed text-ink-faint">
              封面模板只改版式、配色和标题字号。想加图片：在右侧「封面 → 封面图」上传，再选「图上叠字」或「图文分开」。
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

