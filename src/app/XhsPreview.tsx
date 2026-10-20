import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Download, Files, Ruler, Sheet, ZoomIn } from 'lucide-react'
import { parseDocument } from '../core/document/parse'
import {
  XHS_THEMES,
  applyXhsOverrides,
  CardPage,
  XhsMeasureLayer,
  exportCardPngWithPicker,
  canExportToProject,
  exportCardsToDirectory,
  exportCardsToProject,
  exportCardsZip,
  pickExportDirectory,
  supportsDirectoryExport,
  safeFilename,
  type XhsCardSet,
} from '../platforms/xhs'
import { animateScroll, normalizeAnchor, type LineBus } from './scrollSync'
import { useStore } from '../store'
import { useShallow } from 'zustand/react/shallow'


/** 画布内容：卡片轨道 + 底部悬浮工具条（面板遮避由 App 的 CSS 变量驱动） */
export const XhsPreview = ({ bus }: { bus: LineBus }) => {
  const {
    markdown, themeId, size, overrides, watermark, coverText,
    previewScale, setPreviewScale, exportScale, exportFormat,
    showGuides, setShowGuides, inspect,
  } = useStore(
    useShallow((s) => ({
      markdown: s.markdown,
      themeId: s.themeId,
      size: s.size,
      overrides: s.overrides,
      watermark: s.watermark,
      coverText: s.coverText,
      previewScale: s.previewScale,
      setPreviewScale: s.setPreviewScale,
      exportScale: s.exportScale,
      exportFormat: s.exportFormat,
      showGuides: s.showGuides,
      setShowGuides: s.setShowGuides,
      inspect: s.inspect,
    })),
  )
  const [exporting, setExporting] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)
  const cardRefs = useRef<Array<HTMLElement | null>>([])
  const railRef = useRef<HTMLDivElement>(null)

  const [cardSet, setCardSet] = useState<XhsCardSet | null>(null)

  // 卡片轨道滚动 ⇋ 编辑器滚动（按源码行，双向）
  useEffect(() => {
    const rail = railRef.current
    if (!rail || !cardSet) return
    const startLines = cardSet.cards.map((c) => {
      const lines = c.blocks.map((b) => (b as { line?: number }).line).filter((n): n is number => typeof n === 'number')
      return lines.length ? Math.min(...lines) : 0
    })
    if (!startLines.length) return
    const topOf = (el: HTMLElement) => el.getBoundingClientRect().top - rail.getBoundingClientRect().top + rail.scrollTop
    // 只取最细粒度文字块：排除“包含行元素”的段落壳，否则整段会被当成一行，锚点永远落在段首
    const textElsOf = (card: HTMLElement) =>
      [...card.querySelectorAll<HTMLElement>('.xhs-kp-line, .xhs-content > div, [data-list] > div')].filter(
        (e) => !e.querySelector('.xhs-kp-line, .xhs-content > div, [data-list] > div'),
      )

    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        if (bus.info.applying && bus.info.driver !== 'rail') return
        const y = rail.scrollTop + 8
        let idx = 0
        for (let i = 0; i < cardRefs.current.length; i++) {
          const el = cardRefs.current[i]
          if (el && topOf(el) <= y) idx = i
        }
        // 锚点 = 顶部第一段“真正可见”的文字；若当前卡只剩页脚，则顺延到下一张卡
        let anchor = ''
        let anchorIdx = idx
        const railBox = rail.getBoundingClientRect()
        const railTop = railBox.top
        const railBottom = railBox.bottom
        for (let j = idx; j < cardRefs.current.length && j <= idx + 1; j++) {
          const card = cardRefs.current[j]
          if (!card) continue
          const els = textElsOf(card).filter((e) => (e.textContent || '').trim())
          const visible = els.find((e) => {
            const r = e.getBoundingClientRect()
            // 优先取“完整可见”的第一行，避免把被视口切掉一半的行当成锚点
            return r.height > 0 && r.top >= railTop - 1 && r.top < railBottom - 8
          })
          const el = visible ?? (j > idx ? els[0] : undefined)
          if (el) {
            // 极短文字（公式符号、标点行）向后拼接，保证锚点足够可辨识
            let text = el.textContent || ''
            const at = els.indexOf(el)
            for (let k = at + 1; k < els.length && normalizeAnchor(text).length < 8; k++) {
              text += ' ' + (els[k].textContent || '')
            }
            anchor = normalizeAnchor(text).slice(0, 12)
            anchorIdx = j
            break
          }
        }
        bus.reportLine('rail', startLines[anchorIdx] ?? 0, anchor)
      })
    }
    rail.addEventListener('scroll', onScroll, { passive: true })

    const unsub = bus.onLine((src, line, anchor) => {
      if (src === 'rail' || bus.info.applying) return
      bus.info.applying = true
      bus.info.driver = src
      let target: HTMLElement | null = null
      if (anchor) {
        for (const card of cardRefs.current) {
          if (!card) continue
          const el = textElsOf(card).find((e) => normalizeAnchor(e.textContent || '').includes(anchor))
          if (el) {
            target = el
            break
          }
        }
      }
      if (!target) {
        let idx = 0
        for (let i = 0; i < startLines.length; i++) if ((startLines[i] ?? 0) <= line) idx = i
        target = cardRefs.current[idx]
      }
      const run = target ? animateScroll(rail, Math.max(0, topOf(target) - 8), 320) : Promise.resolve()
      run.then(() => {
        window.setTimeout(() => {
          bus.info.applying = false
          bus.info.driver = undefined
          bus.flushPending()
        }, 80)
      })
    })
    return () => {
      rail.removeEventListener('scroll', onScroll)
      unsub()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [bus, cardSet])

  const deferredMarkdown = useDeferredValue(markdown)
  const doc = useMemo(() => parseDocument(deferredMarkdown), [deferredMarkdown])
  const theme = useMemo(() => {
    const base = XHS_THEMES.find(t => t.id === themeId) ?? XHS_THEMES[0]!
    return applyXhsOverrides(base, overrides)
  }, [themeId, overrides])

  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | null>(null)
  const flash = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2400)
  }

  // 文件名优先用封面标题（与导出图一致），其次文档标题
  const baseName = safeFilename(
    String(coverText.title || doc.meta.title || 'notes')
      .split(String.fromCharCode(13))
      .join('')
      .split(String.fromCharCode(10))
      .join(''),
  )
  const totalPages = cardSet?.cards.filter(c => c.kind === 'content').length ?? 0

  const handleExportOne = async (i: number) => {
    const el = cardRefs.current[i]
    if (!el) {
      flash('卡片尚未就绪，请稍候再试')
      return
    }
    setExporting(true)
    flash('请选择保存位置…')
    try {
      const result = await exportCardPngWithPicker(el, `${baseName}-p${String(i + 1).padStart(2, '0')}.${exportFormat === 'jpg' ? 'jpg' : 'png'}`, { scale: exportScale, format: exportFormat })
      if (result === 'saved') flash('已保存当前页 PNG')
      else flash('已取消导出')
    } catch {
      flash('导出失败，请重试')
    } finally {
      setExporting(false)
    }
  }

  /** ZIP 导出（兜底 / 显式按钮共用） */
  const exportZipFiles = async (files: Array<{ el: HTMLElement; name: string }>, reason?: string) => {
    setExporting(true)
    try {
      await exportCardsZip(files, `${baseName}-${files.length}张.zip`, { scale: exportScale, format: exportFormat })
      flash(reason ? `${reason}，已改为下载 ZIP` : `已导出 ${files.length} 张 PNG（ZIP）`)
    } catch {
      flash('导出失败，请重试')
    } finally {
      setExporting(false)
    }
  }

  const handleExportZip = async () => {
    const items = cardRefs.current
      .map((el, i): [HTMLElement, number] | null => (el ? [el, i] : null))
      .filter((x): x is [HTMLElement, number] => x !== null)
    if (!items.length) {
      flash('卡片尚未就绪，请稍候再试')
      return
    }
    await exportZipFiles(items.map(([el, i]) => ({ el, name: `${baseName}-p${String(i + 1).padStart(2, '0')}.png` })))
  }

  const handleExportAll = async () => {
    const items = cardRefs.current
      .map((el, i): [HTMLElement, number] | null => (el ? [el, i] : null))
      .filter((x): x is [HTMLElement, number] => x !== null)
    if (!items.length) {
      flash('卡片尚未就绪，请稍候再试')
      return
    }

    const ext = exportFormat === 'jpg' ? 'jpg' : 'png'
    const files = items.map(([el, i]) => ({ el, name: `${baseName}-p${String(i + 1).padStart(2, '0')}.${ext}` }))
    setExporting(true)
    try {
      // 1) 首选：dev server 直接写入项目 exports/ 目录（绕开浏览器下载限制）
      if (await canExportToProject()) {
        const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, '')
        try {
          const r = await exportCardsToProject(files, `${baseName}-${stamp}`, (done, total) => setToast(`正在导出 ${done}/${total}…`), { scale: exportScale, format: exportFormat })
          flash(`已写入 ${r.rel}（${r.count} 张）`)
          return
        } catch {
          flash('写入项目目录失败，改用目录选择器…')
        }
      }

      // 2) 目录选择器：直接写多张 PNG
      if (supportsDirectoryExport()) {
        flash('请选择导出目录…')
        const t0 = performance.now()
        let dir: Awaited<ReturnType<typeof pickExportDirectory>> = null
        try {
          dir = await pickExportDirectory()
        } catch (err) {
          const name = (err as { name?: string })?.name ?? '未知错误'
          await exportZipFiles(files, `无法打开目录选择器（${name}）`)
          return
        }
        if (!dir) {
          // 瞬间 Abort = 环境不支持（无弹窗）；延迟 Abort = 用户取消
          if (performance.now() - t0 < 600) await exportZipFiles(files, '目录选择器未弹出')
          else flash('已取消导出')
          return
        }
        try {
          await exportCardsToDirectory(files, dir, (done, total) => setToast(`正在导出 ${done}/${total}…`), { scale: exportScale, format: exportFormat })
          flash(`已导出 ${files.length} 张 PNG →「${dir.name}」`)
        } catch {
          flash('写入目录失败，请重试或改用 ZIP')
        }
        return
      }

      // 3) 最后降级：ZIP 下载
      await exportZipFiles(files)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="relative h-full">
      {/* 隐藏度量层（采样 → 分页 → 拆分解析 → 卡片集合） */}
      <XhsMeasureLayer doc={doc} theme={theme} sizeName={size} cover={theme.layout.coverOn ? 'auto' : 'off'} onCardSet={setCardSet} />

      {/* 卡片轨道（左右留白避让浮动面板） */}
      <div ref={railRef} className="h-full overflow-auto">
        <div
          className="mx-auto flex w-fit flex-col gap-6 py-6"
          style={{ paddingLeft: 'var(--rail-pl)', paddingRight: 'var(--rail-pr)' }}
        >
          {cardSet?.cards.map((card, i) => (
            <CardFrame
              key={i}
              width={cardSet.size.width}
              height={cardSet.size.height}
              scale={previewScale}
              cardRef={(el) => { cardRefs.current[i] = el }}
              onExportIndex={i}
              onExportSingle={handleExportOne}
              exporting={exporting}
            >
              <CardPage card={card} theme={theme} watermark={watermark} coverText={coverText} guides={showGuides} inspect={inspect} pageW={cardSet?.size.width} pageH={cardSet?.size.height} />
            </CardFrame>
          ))}
          {cardSet && <div className="h-8" />}
        </div>
      </div>

      {/* 导出完成提示 */}
      {toast && (
        <div className="pointer-events-none absolute bottom-[74px] left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink/90 px-3.5 py-1.5 text-[11.5px] text-white shadow-lg">
          {toast}
        </div>
      )}

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
          className={`tip flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
            showGuides ? 'border-black/[0.18] bg-ink text-white' : 'border-black/[0.14] bg-white text-ink-soft hover:bg-black/[0.04]'
          }`}
          onClick={() => setShowGuides(!showGuides)}
          data-tip="显示工程标注：边距、版心与尺寸线"
        >
          <Ruler className="h-3.5 w-3.5" strokeWidth={1.8} />
          参考线
        </button>

        {/* 缩放：自绘下拉，带图标与当前值勾选 */}
        <div className="relative">
          <button
            className="tip flex items-center gap-1 rounded-full border border-black/[0.12] bg-white px-2.5 py-1 text-[11px] text-ink-soft transition-colors hover:bg-black/[0.04]"
            onClick={() => setZoomOpen((v) => !v)}
            data-tip="预览缩放"
          >
            <ZoomIn className="h-3.5 w-3.5" strokeWidth={1.8} />
            <span className="tabular-nums text-ink">{Math.round(previewScale * 100)}%</span>
            <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${zoomOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
          </button>
          {zoomOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setZoomOpen(false)} />
              <div className="absolute bottom-full left-1/2 z-50 mb-2 w-[104px] -translate-x-1/2 rounded-xl border border-black/10 bg-white p-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
                {[0.42, 0.56, 0.7, 0.84].map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      setPreviewScale(v)
                      setZoomOpen(false)
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[11px] transition-colors ${
                      previewScale === v ? 'bg-black/[0.06] font-medium text-ink' : 'text-ink-soft hover:bg-black/[0.04]'
                    }`}
                  >
                    <span className="tabular-nums">{Math.round(v * 100)}%</span>
                    {previewScale === v && <Check className="h-3 w-3" strokeWidth={2.2} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          className="tip flex items-center gap-1 rounded-full border border-black/[0.14] bg-white px-3 py-1 text-[11.5px] text-ink transition-colors hover:bg-black/[0.04] disabled:opacity-40"
          onClick={() => handleExportOne(0)}
          disabled={exporting}
          data-tip="导出当前页"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
          当前
        </button>
        <button
          className="tip flex items-center gap-1 rounded-full bg-ink px-3.5 py-1 text-[11.5px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
          onClick={handleExportAll}
          disabled={exporting || !cardSet}
          data-tip="导出全部：优先写入项目 exports/"
        >
          <Files className="h-3.5 w-3.5" strokeWidth={1.8} />
          {exporting ? '导出中…' : '全部'}
        </button>
        <button
          className="tip rounded-full border border-black/[0.14] bg-white px-2.5 py-1 text-[11px] text-ink-soft transition-colors hover:bg-black/[0.04] disabled:opacity-40"
          onClick={handleExportZip}
          disabled={exporting || !cardSet}
          data-tip="打包下载 ZIP"
        >
          ZIP
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
      className={`tip glass absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink transition-all hover:text-accent ${
        exporting ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
      }`}
      onClick={() => onExportSingle(onExportIndex)}
      disabled={exporting}
      data-tip="导出这张"
    >
      <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
    </button>
  </div>
)
