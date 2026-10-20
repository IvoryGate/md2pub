import { toJpeg, toPng } from 'html-to-image'
import JSZip from 'jszip'

/**
 * 导出层：只依赖 DOM 卡片节点（data-export-root 标记），与渲染解耦。
 * 渲染端保证导出根节点带该属性，本模块负责像素与文件产物。
 */

export interface ExportOptions {
  scale?: 1 | 2 | 3
  format?: 'png' | 'jpg'
}

const nodeToDataUrl = (el: HTMLElement, opts?: ExportOptions) => {
  const scale = opts?.scale ?? 2
  if (opts?.format === 'jpg')
    return toJpeg(el, { pixelRatio: scale, cacheBust: true, quality: 0.95, backgroundColor: '#ffffff' })
  return toPng(el, { pixelRatio: scale, cacheBust: true, backgroundColor: '#ffffff' })
}

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
export async function exportCardPng(el: HTMLElement, filename: string, opts?: ExportOptions): Promise<void> {
  const dataUrl = await nodeToDataUrl(el, opts)
  const blob = await (await fetch(dataUrl)).blob()
  const ext = opts?.format === 'jpg' ? '.jpg' : '.png'
  triggerDownload(blob, filename.endsWith('.png') || filename.endsWith('.jpg') ? filename : `${filename}${ext}`)
}

export interface ZipCardInput {
  el: HTMLElement
  name: string // 已含 .png 后缀
}

/** 导出多张卡片为 ZIP */
export async function exportCardsZip(
  cards: ZipCardInput[],
  zipName?: string,
  opts?: ExportOptions,
): Promise<void> {
  const zip = new JSZip()
  for (const { el, name } of cards) {
    const dataUrl = await nodeToDataUrl(el, opts)
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
  opts?: ExportOptions,
): Promise<void> {
  let i = 0
  for (const { el, name } of cards) {
    const dataUrl = await nodeToDataUrl(el, opts)
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
export async function exportCardPngWithPicker(el: HTMLElement, name: string, opts?: ExportOptions): Promise<'saved' | 'cancelled'> {
  const picker = (window as unknown as {
    showSaveFilePicker?: (o: unknown) => Promise<FileHandleLike>
  }).showSaveFilePicker
  const ext = opts?.format === 'jpg' ? '.jpg' : '.png'
  if (!picker) {
    await exportCardPng(el, name, opts)
    return 'saved'
  }
  try {
    const handle = await picker({
      suggestedName: name.endsWith('.png') || name.endsWith('.jpg') ? name : `${name}${ext}`,
      types: [{ description: '图片', accept: { 'image/png': ['.png'], 'image/jpeg': ['.jpg'] } }],
    })
    const dataUrl = await nodeToDataUrl(el, opts)
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


// ---------- 写入本地项目目录（dev server 端点，绕开浏览器下载限制） ----------

export const canExportToProject = async (): Promise<boolean> => {
  try {
    const r = await fetch('/__md2pub/export', { headers: { Accept: 'application/json' } })
    if (!(r.headers.get('content-type') ?? '').includes('application/json')) return false
    const j = (await r.json()) as { dev?: boolean }
    return !!j?.dev
  } catch {
    return false
  }
}

/** 逐张生成 PNG 并以 base64 交给 dev server 写入 exports/ */
export async function exportCardsToProject(
  cards: ZipCardInput[],
  subdir: string,
  onProgress?: (done: number, total: number) => void,
  opts?: ExportOptions,
): Promise<{ rel: string; count: number }> {
  const files: Array<{ name: string; data: string }> = []
  let i = 0
  for (const { el, name } of cards) {
    const dataUrl = await nodeToDataUrl(el, opts)
    files.push({ name, data: dataUrl.split(',')[1] ?? '' })
    i++
    onProgress?.(i, cards.length)
  }
  const res = await fetch('/__md2pub/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir: subdir, files }),
  })
  const json = (await res.json().catch(() => null)) as { ok?: boolean; rel?: string; count?: number; error?: string } | null
  if (!res.ok || !json?.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
  return { rel: json.rel ?? subdir, count: json.count ?? files.length }
}
