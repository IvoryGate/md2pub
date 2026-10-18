import { useMemo, useRef, useState } from 'react'
import { parseDocument } from '../core/document/parse'
import {
  XHS_THEMES,
  XHS_CARD_SIZES,
  computeContentMetrics,
  applyXhsOverrides,
  CardPage,
  XhsMeasureLayer,
  buildCardSet,
  useMeasuredHeights,
  exportCardPng,
  exportCardsZip,
  safeFilename,
} from '../platforms/xhs'
import { useStore } from '../store'

const PREVIEW_SCALE = 0.34

/** 中央画布：点阵背景 + 卡片轨道 + 导出工具条（仅依赖 xhs 平台 public API） */
export const XhsPreview = () => {
  const { markdown, themeId, size, overrides } = useStore()
  const [exporting, setExporting] = useState(false)
  const cardRefs = useRef<Array<HTMLElement | null>>([])

  const doc = useMemo(() => parseDocument(markdown), [markdown])
  // 与 App 三栏共享同一份合成规则：主题预设 + UI 参数覆盖
  const theme = useMemo(
    () => {
      const base = XHS_THEMES.find(t => t.id === themeId) ?? XHS_THEMES[0]!
      return applyXhsOverrides(base, overrides)
    },
    [themeId, overrides],
  )

  const [heights, onHeights] = useMeasuredHeights()
  const cardSet = useMemo(
    () => (heights ? buildCardSet(doc, heights, theme, size, { cover: 'auto' }) : null),
    [heights, doc, theme, size],
  )

  const contentWidth = useMemo(
    () => computeContentMetrics(XHS_CARD_SIZES[size], theme).contentWidth,
    [size, theme],
  )

  const baseName = safeFilename(doc.meta.title ?? 'notes')
  const totalPages = cardSet?.cards.filter(c => c.kind === 'content').length ?? 0

  const handleExportOne = async (i: number) => {
    const el = cardRefs.current[i]
    if (!el) return
    setExporting(true)
    try {
      await exportCardPng(el, `${baseName}-p${String(i + 1).padStart(2, '0')}`)
    } finally {
      setExporting(false)
    }
  }

  const handleExportAll = async () => {
    setExporting(true)
    try {
      const items = cardRefs.current
        .map((el, i): [HTMLElement, number] | null => (el ? [el, i] : null))
        .filter((x): x is [HTMLElement, number] => x !== null)
      await exportCardsZip(
        items.map(([el, i]) => ({
          el,
          name: `${baseName}-p${String(i + 1).padStart(2, '0')}.png`,
        })),
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* 隐藏度量层 */}
      <XhsMeasureLayer doc={doc} theme={theme} contentWidth={contentWidth} onHeights={onHeights} />

      {/* 画布工具条 */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line bg-panel px-4">
        <span className="text-[12.5px] font-semibold text-ink">小红书</span>
        <span className="rounded-full bg-sunken px-2 py-0.5 text-[10.5px] font-medium tabular-nums text-ink-soft">
          {cardSet ? `${totalPages} 页正文` : '…计算版式'}
        </span>
        {cardSet && cardSet.warnings.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] text-amber-700">
            {cardSet.warnings.length} 处溢出
          </span>
        )}
        <div className="flex-1" />
        <button
          className="rounded-full bg-accent px-3.5 py-1 text-[11.5px] font-medium text-white shadow-[0_1px_4px_rgba(255,36,66,0.35)] transition-colors hover:bg-accent-deep disabled:opacity-40"
          onClick={handleExportAll}
          disabled={exporting || !cardSet}
        >
          {exporting ? '导出中…' : '导出全部 ZIP'}
        </button>
      </div>

      {/* 溢出告警条 */}
      {cardSet && cardSet.warnings.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[11px] leading-relaxed text-amber-700">
          {cardSet.warnings.slice(0, 2).map((w, i) => (
            <div key={i}>⚠️ {w}</div>
          ))}
        </div>
      )}

      {/* 点阵画布 · 卡片轨道 */}
      <div className="canvas-dots min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-fit flex-col gap-7 px-10 py-8">
          {cardSet?.cards.map((card, i) => (
            <CardFrame
              key={i}
              label={card.kind === 'cover' ? '封面' : `P${card.page}`}
              width={cardSet.size.width}
              height={cardSet.size.height}
              scale={PREVIEW_SCALE}
              cardRef={(el) => { cardRefs.current[i] = el }}
              onExportSingle={handleExportOne}
              onExportIndex={i}
              exporting={exporting}
            >
              <CardPage card={card} theme={theme} />
            </CardFrame>
          ))}
        </div>
      </div>
    </div>
  )
}

/** 卡片轨道项：标签 chip + PNG 快捷键 + 原生分辨率渲染 */
const CardFrame = ({
  label,
  width,
  height,
  scale,
  children,
  cardRef,
  onExportSingle,
  onExportIndex,
  exporting,
}: {
  label: string
  width: number
  height: number
  scale: number
  children: React.ReactNode
  cardRef: (el: HTMLElement | null) => void
  onExportSingle: (i: number) => void
  onExportIndex: number
  exporting: boolean
}) => (
  <div className="group flex flex-col items-center gap-1.5">
    <div className="flex items-center gap-2">
      <span
        className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${
          label === '封面' ? 'bg-accent text-white' : 'bg-panel text-ink-soft shadow-sm ring-1 ring-line'
        }`}
      >
        {label}
      </span>
      <button
        className="rounded-full bg-panel px-2 py-0.5 text-[10px] text-ink-soft opacity-0 shadow-sm ring-1 ring-line transition-opacity hover:text-accent group-hover:opacity-100"
        onClick={() => onExportSingle(onExportIndex)}
        disabled={exporting}
      >
        PNG
      </button>
    </div>
    <div
      className="relative overflow-hidden rounded-2xl bg-white shadow-[0_8px_28px_rgba(32,29,25,0.13),0_2px_6px_rgba(32,29,25,0.08)] transition-shadow group-hover:shadow-[0_12px_36px_rgba(32,29,25,0.18)]"
      style={{ width: width * scale, height: height * scale }}
    >
      <div
        ref={(el) => cardRef(el?.querySelector<HTMLElement>('[data-xhs-card]') ?? null)}
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width, height }}
      >
        {children}
      </div>
    </div>
  </div>
)
