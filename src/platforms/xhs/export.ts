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
  URL.revokeObjectURL(url)
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
