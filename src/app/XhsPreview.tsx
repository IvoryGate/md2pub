import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Files, Sheet } from 'lucide-react'
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
import { bindSyncScroll, type ScrollBus } from './scrollSync'
import { useStore } from '../store'

const PREVIEW_SCALE = 0.42

/** 画布内容：卡片轨道 + 底部悬浮工具条（面板遮避由 App 的 CSS 变量驱动） */
export const XhsPreview = ({ bus }: { bus: ScrollBus }) => {
  const { markdown, themeId, size, overrides, watermark, coverText } = useStore()
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

  const [cardSet, setCardSet] = useState<XhsCardSet | null>(null)
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
      const result = await exportCardPngWithPicker(el, `${baseName}-p${String(i + 1).padStart(2, '0')}.png`)
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
      await exportCardsZip(files, `${baseName}-${files.length}张.zip`)
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

    const files = items.map(([el, i]) => ({ el, name: `${baseName}-p${String(i + 1).padStart(2, '0')}.png` }))
    setExporting(true)
    try {
      // 1) 首选：dev server 直接写入项目 exports/ 目录（绕开浏览器下载限制）
      if (await canExportToProject()) {
        const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, '')
        try {
          const r = await exportCardsToProject(files, `${baseName}-${stamp}`, (done, total) => setToast(`正在导出 ${done}/${total}…`))
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
          await exportCardsToDirectory(files, dir, (done, total) => setToast(`正在导出 ${done}/${total}…`))
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
              <CardPage card={card} theme={theme} watermark={watermark} coverText={coverText} />
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
          title="导出全部 PNG：优先写入项目 exports/，其次选择文件夹"
        >
          <Files className="h-3.5 w-3.5" strokeWidth={1.8} />
          {exporting ? '导出中…' : '全部'}
        </button>
        <button
          className="rounded-full border border-black/[0.14] bg-white px-2.5 py-1 text-[11px] text-ink-soft transition-colors hover:bg-black/[0.04] disabled:opacity-40"
          onClick={handleExportZip}
          disabled={exporting || !cardSet}
          title="不选目录，直接下载 ZIP"
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
