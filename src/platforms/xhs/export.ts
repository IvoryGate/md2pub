import { toPng } from 'html-to-image'
import JSZip from 'jszip'

/**
 * 导出层：只依赖 DOM 卡片节点（data-export-root 标记），与渲染解耦。
 * 渲染端保证导出根节点带该属性，本模块负责像素与文件产物。
 */

const EXPORT_SCALE = 2

const nodeToPngDataUrl = (el: HTMLElement) =>
  toPng(el, { pixelRatio: EXPORT_SCALE, cacheBust: true, backgroundColor: '#ffffff' })

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // 延迟回收：立即 revoke 会让部分浏览器取消下载
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export const safeFilename = (text: string): string =>
  text.replace(/[/\\:*?"<>|#\s]+/g, '_').slice(0, 40) || 'untitled'

/** 导出单张卡片 PNG */
export async function exportCardPng(el: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await nodeToPngDataUrl(el)
  const blob = await (await fetch(dataUrl)).blob()
  triggerDownload(blob, filename.endsWith('.png') ? filename : `${filename}.png`)
}

export interface ZipCardInput {
  el: HTMLElement
  name: string // 已含 .png 后缀
}

/** 导出多张卡片为 ZIP */
export async function exportCardsZip(
  cards: ZipCardInput[],
  zipName?: string,
): Promise<void> {
  const zip = new JSZip()
  for (const { el, name } of cards) {
    const dataUrl = await nodeToPngDataUrl(el)
    zip.file(name, dataUrl.split(',')[1]!, { base64: true })
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, zipName ?? `md2pub-xhs-${Date.now()}.zip`)
}


// ---------- 本地目录导出（File System Access API） ----------

interface WritableLike {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}
interface FileHandleLike {
  createWritable(): Promise<WritableLike>
}
export interface DirHandleLike {
  name: string
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileHandleLike>
}

export const supportsDirectoryExport = () =>
  typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'

/** 让用户选择导出目录；取消返回 null */
export async function pickExportDirectory(): Promise<DirHandleLike | null> {
  try {
    const picker = (window as unknown as { showDirectoryPicker: (o?: unknown) => Promise<DirHandleLike> }).showDirectoryPicker
    return await picker({ mode: 'readwrite', id: 'md2pub-export' })
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return null
    throw err
  }
}

/** 逐张写 PNG 到用户选择的目录（不进浏览器下载目录） */
export async function exportCardsToDirectory(
  cards: ZipCardInput[],
  dir: DirHandleLike,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  let i = 0
  for (const { el, name } of cards) {
    const dataUrl = await nodeToPngDataUrl(el)
    const blob = await (await fetch(dataUrl)).blob()
    const fh = await dir.getFileHandle(name, { create: true })
    const w = await fh.createWritable()
    await w.write(blob)
    await w.close()
    i++
    onProgress?.(i, cards.length)
  }
}

/** 单张 PNG：弹出系统保存对话框自选路径；不支持时退回下载 */
export async function exportCardPngWithPicker(el: HTMLElement, name: string): Promise<'saved' | 'cancelled'> {
  const picker = (window as unknown as {
    showSaveFilePicker?: (o: unknown) => Promise<FileHandleLike>
  }).showSaveFilePicker
  if (!picker) {
    await exportCardPng(el, name)
    return 'saved'
  }
  try {
    const handle = await picker({
      suggestedName: name.endsWith('.png') ? name : `${name}.png`,
      types: [{ description: 'PNG 图片', accept: { 'image/png': ['.png'] } }],
    })
    const dataUrl = await nodeToPngDataUrl(el)
    const blob = await (await fetch(dataUrl)).blob()
    const w = await handle.createWritable()
    await w.write(blob)
    await w.close()
    return 'saved'
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return 'cancelled'
    throw err
  }
}
