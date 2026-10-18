import { useMemo, useRef, useState } from 'react'
import { parseDocument } from '../core/document/parse'
import {
  XHS_THEMES,
  XHS_CARD_SIZES,
  computeContentMetrics,
  CardPage,
  XhsMeasureLayer,
  buildCardSet,
  useMeasuredHeights,
  exportCardPng,
  exportCardsZip,
  safeFilename,
} from '../platforms/xhs'
import { useStore } from '../store'

const PREVIEW_SCALE = 0.35

/** 小红书预览 & 导出（MVP 的第一个平台面板，仅依赖 xhs 平台 public API） */
export const XhsPreview = () => {
  const { markdown, themeId, size, watermark } = useStore()
  const [exporting, setExporting] = useState(false)
  const cardRefs = useRef<Array<HTMLElement | null>>([])

  const doc = useMemo(() => parseDocument(markdown), [markdown])
  const theme = useMemo(() => {
    const base = XHS_THEMES.find(t => t.id === themeId) ?? XHS_THEMES[0]!
    return { ...base, watermark: { ...base.watermark, text: watermark || base.watermark.text } }
  }, [themeId, watermark])

  // 度量 → 分页（测高驱动）。度量层始终渲染（隐藏），卡片在高度就绪后才生成。
  const [heights, onHeights] = useMeasuredHeights()
  const cardSet = useMemo(
    () => (heights ? buildCardSet(doc, heights, theme, size, { cover: 'auto' }) : null),
    [heights, doc, theme, size],
  )

  const baseName = safeFilename(doc.meta.title ?? 'notes')
  const contentWidth = useMemo(
    () => computeContentMetrics(XHS_CARD_SIZES[size], theme).contentWidth,
    [size, theme],
  )

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
      {/* 隐藏度量层：与卡片渲染同源，驱动自动分页 */}
      <XhsMeasureLayer
        doc={doc}
        theme={theme}
        contentWidth={contentWidth}
        onHeights={onHeights}
      />

      <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-2">
        <span className="text-sm font-semibold text-stone-700">
          小红书{cardSet ? ` · ${cardSet.cards.length} 张` : ' · 计算版式…'}
        </span>
        <div className="flex-1" />
        <button
          className="rounded-md bg-stone-100 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-200 disabled:opacity-50"
          disabled={exporting || !cardSet}
          onClick={handleExportAll}
        >
          {exporting ? '导出中…' : '全部导出 ZIP'}
        </button>
      </div>

      {/* 分页告警 */}
      {cardSet && cardSet.warnings.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] leading-relaxed text-amber-700">
          {cardSet.warnings.slice(0, 3).map((w, i) => (
            <div key={i}>⚠️ {w}</div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-stone-200/60 p-6">
        <div className="mx-auto flex w-fit flex-col gap-8">
          {cardSet?.cards.map((card, i) => (
            <CardFrame
              key={i}
              label={card.kind === 'cover' ? '封面' : `P${card.page}`}
              width={cardSet.size.width}
              height={cardSet.size.height}
              scale={PREVIEW_SCALE}
              cardRef={(el) => { cardRefs.current[i] = el }}
              onExportSingle={() => handleExportOne(i)}
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

/** 预览容器：原生尺寸渲染 + transform 缩放显示；导出直接取原生 DOM 节点 */
const CardFrame = ({
  label,
  width,
  height,
  scale,
  children,
  cardRef,
  onExportSingle,
  exporting,
}: {
  label: string
  width: number
  height: number
  scale: number
  children: React.ReactNode
  cardRef: (el: HTMLElement | null) => void
  onExportSingle: () => void
  exporting: boolean
}) => (
  <div className="flex flex-col items-center gap-2">
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-stone-500">{label}</span>
      <button
        className="rounded border border-stone-300 bg-white px-2 py-0.5 text-[10px] text-stone-600 hover:bg-stone-100 disabled:opacity-50"
        onClick={onExportSingle}
        disabled={exporting}
      >
        PNG
      </button>
    </div>
    <div
      className="relative overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/5"
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
