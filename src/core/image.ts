/**
 * 图片文件 → data URL（用于粘贴/上传）。
 * - SVG 保留矢量，不栅格化；
 * - 最长边超过 max 时等比缩放；
 * - PNG 保留透明与文字锐度，其他格式输出 JPEG（白底）；
 * - 小图且文件不大时直接返回原始 data URL，避免二次压缩。
 */
export async function imageFileToDataUrl(file: File, max = 1600): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('不是图片文件')
  if (file.size > 12 * 1024 * 1024) throw new Error('图片需小于 12MB')

  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })

  if (file.type === 'image/svg+xml') return raw

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('解析图片失败'))
    el.src = raw
  })

  const longest = Math.max(img.width, img.height)
  if (longest <= max && file.size <= 900 * 1024) return raw

  const scale = Math.min(1, max / longest)
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return raw

  const png = file.type === 'image/png'
  if (!png) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86)
}

/** 从文件名生成安全的 alt 文本 */
export const imageAltFromFile = (file: File) =>
  (file.name.replace(/\.[^.]+$/, '') || '图片').replace(/[[\]()|]/g, '').trim().slice(0, 36) || '图片'
