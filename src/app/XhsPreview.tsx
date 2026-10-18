import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Files, Sheet } from 'lucide-react'
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
import { bindSyncScroll, type ScrollBus } from './scrollSync'
import { useStore } from '../store'

const PREVIEW_SCALE = 0.42

/** 画布内容：卡片轨道 + 底部悬浮工具条（面板遮避由 App 的 CSS 变量驱动） */
export const XhsPreview = ({ bus }: { bus: ScrollBus }) => {
  const { markdown, themeId, size, overrides } = useStore()
  const [exporting, setExporting] = useState(false)
  const cardRefs = useRef<Array<HTMLElement | null>>([])
  const railRef = useRef<HTMLDivElement>(null)

  // 卡片轨道滚动 ⇋ 编辑器滚动（双向）
  useEffect(() => {
    const el = railRef.current
    if (!el) return
    return bindSyncScroll(el, 'rail', bus)
  }, [bus])

  const doc = useMemo(() => parseDocument(markdown), [markdown])
  const theme = useMemo(() => {
    const base = XHS_THEMES.find(t => t.id === themeId) ?? XHS_THEMES[0]!
    return applyXhsOverrides(base, overrides)
  }, [themeId, overrides])

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
    <div className="relative h-full">
      {/* 隐藏度量层 */}
      <XhsMeasureLayer doc={doc} theme={theme} contentWidth={contentWidth} onHeights={onHeights} />

      {/* 卡片轨道（左右留白避让浮动面板） */}
      <div ref={railRef} className="h-full overflow-y-auto">
        <div
          className="mx-auto flex w-fit flex-col gap-6 py-6"
          style={{ paddingLeft: 'var(--rail-pl)', paddingRight: 'var(--rail-pr)' }}
        >
          {cardSet?.cards.map((card, i) => (
            <CardFrame
              key={i}
              width={cardSet.size.width}
              height={cardSet.size.height}
              scale={PREVIEW_SCALE}
              cardRef={(el) => { cardRefs.current[i] = el }}
              onExportIndex={i}
              onExportSingle={handleExportOne}
              exporting={exporting}
            >
              <CardPage card={card} theme={theme} />
            </CardFrame>
          ))}
          {cardSet && <div className="h-8" />}
        </div>
      </div>

      {/* 底部悬浮工具条 */}
      <div className="glass absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full p-1.5 pl-3">
        <Sheet className="mr-0.5 h-3.5 w-3.5 text-ink-soft" strokeWidth={1.8} />
        <span className="text-[12px] font-medium tabular-nums text-ink">
          {cardSet ? `${totalPages} 页` : '…'}
        </span>
        {cardSet && cardSet.warnings.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] text-amber-700">
            {cardSet.warnings.length} 处溢出
          </span>
        )}
        <div className="mx-0.5 h-4 w-px bg-black/10" />
        <button
          className="flex items-center gap-1 rounded-full border border-black/[0.14] bg-white px-3 py-1 text-[11.5px] text-ink transition-colors hover:bg-black/[0.04] disabled:opacity-40"
          onClick={() => handleExportOne(0)}
          disabled={exporting}
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
          当前
        </button>
        <button
          className="flex items-center gap-1 rounded-full bg-ink px-3.5 py-1 text-[11.5px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
          onClick={handleExportAll}
          disabled={exporting || !cardSet}
        >
          <Files className="h-3.5 w-3.5" strokeWidth={1.8} />
          {exporting ? '导出中…' : '全部'}
        </button>
      </div>
    </div>
  )
}

/** 卡片轨道项：原生分辨率渲染，卡片右上角悬浮单页导出（不占版面） */
const CardFrame = ({
  width,
  height,
  scale,
  children,
  cardRef,
  onExportSingle,
  onExportIndex,
  exporting,
}: {
  width: number
  height: number
  scale: number
  children: React.ReactNode
  cardRef: (el: HTMLElement | null) => void
  onExportSingle: (i: number) => void
  onExportIndex: number
  exporting: boolean
}) => (
  <div className="group relative w-fit">
    <div
      className="relative overflow-hidden rounded-[18px] bg-white transition-shadow"
      style={{
        width: width * scale,
        height: height * scale,
        boxShadow: '0 18px 50px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <div
        ref={(el) => cardRef(el?.querySelector<HTMLElement>('[data-xhs-card]') ?? null)}
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width, height }}
      >
        {children}
      </div>
    </div>
    {/* 悬浮单页导出：hover 才出现，右上角 */}
    <button
      className={`glass absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink transition-all hover:text-accent ${
        exporting ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
      }`}
      onClick={() => onExportSingle(onExportIndex)}
      disabled={exporting}
      title="导出这张（PNG）"
    >
      <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
    </button>
  </div>
)
