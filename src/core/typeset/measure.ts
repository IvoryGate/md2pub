/**
 * 文字前进宽度测量。
 * 与 DOM 渲染同一 shaping 引擎（同 font 字符串 → 同结果），所见即所量：
 * - 拉丁词做整词测量，词内 kerning 由 shaper 处理，量宽天生精确
 * - CJK 序列逐字测量：中日韩表意文字无 kerning 对，逐字和 = 整行宽
 * - letter-spacing 按浏览器语义逐字符（含末字符）追加
 */

let ctx: CanvasRenderingContext2D | null = null
const cache = new Map<string, number>()

export interface TypesetFont {
  /** CSS font-family（含引号形式） */
  family: string
  weight: number
  /** px */
  size: number
  /** px，正字间距 */
  letterSpacing: number
}

const canvas = (): CanvasRenderingContext2D => {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')!
  return ctx
}

const fontCss = (f: TypesetFont) => `${f.weight} ${f.size}px ${f.family}`

/** 文本串的前进宽度 px（含逐字符 letter-spacing） */
export const advanceWidth = (text: string, f: TypesetFont): number => {
  if (!text) return 0
  const key = `${f.weight}|${f.size}|${f.family}|${f.letterSpacing}|${text}`
  const hit = cache.get(key)
  if (hit != null) return hit
  const c = canvas()
  c.font = fontCss(f)
  const w = c.measureText(text).width + f.letterSpacing * text.length
  if (cache.size > 30000) cache.clear()
  cache.set(key, w)
  return w
}

/** 清空度量缓存（字体加载完成后调用，防止以 fallback 字体测得的宽度残留） */
export const resetMeasureCache = () => cache.clear()
