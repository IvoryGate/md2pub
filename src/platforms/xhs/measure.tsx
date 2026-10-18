import { useEffect, useMemo, useRef, useState } from 'react'
import type { Document } from '../../core/document/types'
import type { XhsCardSizeName, XhsCardTheme } from './theme'
import { XHS_CARD_SIZES, computeContentMetrics } from './theme'
import { paginate, assembleCards, type XhsCardSet, type XhsLayoutContext } from './layout'
import { BlockView } from './CardPage'

/**
 * 度量与自动分页入口。
 * 原则：「测多高就占多高」——度量用的渲染器与卡片渲染严格同源（同一个 BlockView），
 * 用 ResizeObserver 跟踪每块实际高度（图片/KaTeX/Mermaid 均异步撑高，最终稳定）。
 * 本文件不承担分页算法，只做 DOM 采样并回调；算法在 layout.paginate（纯逻辑）。
 */

const HIDDEN_STYLE: React.CSSProperties = {
  position: 'fixed',
  left: -100000,
  top: 0,
  visibility: 'hidden',
  pointerEvents: 'none',
  zIndex: -1,
}

interface MeasureLayerProps {
  doc: Document
  theme: XhsCardTheme
  contentWidth: number
  onHeights: (heights: Record<number, number>) => void
}

/** 隐藏的逐块渲染层，输出每块实测高度 */
export const XhsMeasureLayer = ({ doc, theme, contentWidth, onHeights }: MeasureLayerProps) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const onHeightsRef = useRef(onHeights)
  onHeightsRef.current = onHeights

  const visibleBlocks = useMemo(
    () => doc.blocks.map((b, i) => ({ block: b, index: i })).filter(x => x.block.type !== 'pagebreak'),
    [doc.blocks],
  )

  const measure = () => {
    const root = rootRef.current
    if (!root) return
    const wrappers = Array.from(root.children) as HTMLElement[]
    if (wrappers.length !== visibleBlocks.length) return // 渲染尚未同步
    const next: Record<number, number> = {}
    wrappers.forEach((w, i) => {
      // 高度须含外边距：卡片容器 flex 列 + gap 不塌缩，margin 参与
      const cs = window.getComputedStyle(w)
      const vertical =
        parseFloat(cs.marginTop || '0') + parseFloat(cs.marginBottom || '0')
      next[visibleBlocks[i]!.index] = w.getBoundingClientRect().height + vertical
    })
    onHeightsRef.current(next)
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const wrappers = Array.from(root.children) as HTMLElement[]

    // 初测 + 异步内容（图片 / KaTeX 字体 / Mermaid SVG）改变高度后的跟踪
    measure()
    const ro = new ResizeObserver(() => measure())
    wrappers.forEach(w => ro.observe(w))
    if (document.fonts?.status === 'loading') document.fonts.ready.then(measure).catch(() => {})
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, theme, contentWidth])

  return (
    <div ref={rootRef} style={HIDDEN_STYLE}>
      {visibleBlocks.map(({ block }, i) => (
        <div key={i} style={{ width: contentWidth }}>
          <BlockView block={block} theme={theme} />
        </div>
      ))}
    </div>
  )
}

/** 触发一次完整度量揉合：paginate（纯逻辑）→ assembleCards */
export function buildCardSet(
  doc: Document,
  heights: Record<number, number>,
  theme: XhsCardTheme,
  sizeName: XhsCardSizeName,
  ctx: Omit<XhsLayoutContext, 'size'>,
): XhsCardSet {
  const dims = XHS_CARD_SIZES[sizeName]
  const { availableHeight, body } = computeContentMetrics(dims, theme)
  const { pages, warnings } = paginate(
    doc,
    doc.blocks.map((_, i) => ({ height: heights[Number(i)] ?? 0 })),
    { availableHeight, blockGap: body.paragraphSpacing },
  )
  return assembleCards(doc, { cover: ctx.cover, size: sizeName }, dims, pages, warnings)
}

/** 父组件侧使用：高度稳定后才生成卡片（避免抖动） */
export function useMeasuredHeights(): [
  Record<number, number> | null,
  (h: Record<number, number>) => void,
] {
  const [heights, setHeights] = useState<Record<number, number> | null>(null)
  const callback = (next: Record<number, number>) => {
    setHeights(prev => {
      if (prev && Object.keys(prev).length === Object.keys(next).length) {
        const delta = Object.entries(next).some(
          ([k, v]) => Math.abs((prev[Number(k)] ?? 0) - v) > 1,
        )
        if (!delta) return prev
      }
      return next
    })
  }
  return [heights, callback]
}
