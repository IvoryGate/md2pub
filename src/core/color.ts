/**
 * 色彩数学（纯函数）：sRGB ↔ OKLCH、WCAG 对比度。
 * 采用 OKLCH 是因为它感知均匀——等角度步长 = 等感知变化，
 * HSL 的「等明度」跨色相并不可信（黄比蓝亮得多）。
 */

export interface Oklch {
  /** 0~1 */
  l: number
  /** 0~0.4 左右 */
  c: number
  /** 0~360 */
  h: number
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

const srgbToLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const linearToSrgb = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6)
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const rgbToHex = (r: number, g: number, b: number): string => {
  const to = (v: number) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')
  return `#${to(r / 255)}${to(g / 255)}${to(b / 255)}`
}

/** sRGB(0-255) → OKLab */
export const rgbToOklab = (r: number, g: number, b: number): [number, number, number] => {
  const lr = srgbToLinear(r / 255)
  const lg = srgbToLinear(g / 255)
  const lb = srgbToLinear(b / 255)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

export const oklabToRgb = (L: number, a: number, bb: number): [number, number, number] => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  return [linearToSrgb(clamp01(lr)) * 255, linearToSrgb(clamp01(lg)) * 255, linearToSrgb(clamp01(lb)) * 255]
}

export const hexToOklch = (hex: string): Oklch => {
  const [r, g, b] = hexToRgb(hex)
  const [L, a, bb] = rgbToOklab(r, g, b)
  const c = Math.hypot(a, bb)
  let h = (Math.atan2(bb, a) * 180) / Math.PI
  if (h < 0) h += 360
  return { l: L, c, h }
}

/** OKLCH → hex；超出 sRGB 色域时按彩度回落，保证输出有效颜色 */
export const oklchToHex = (l: number, c: number, h: number): string => {
  const rad = (h * Math.PI) / 180
  const toHex = (L: number, C: number) => {
    const [r, g, b] = oklabToRgb(L, Math.cos(rad) * C, Math.sin(rad) * C)
    return rgbToHex(r, g, b)
  }
  let C = c
  for (let i = 0; i < 24; i++) {
    const hex = toHex(l, C)
    const back = hexToOklch(hex)
    // 往返后彩度明显下降 = 越界被裁掉，降一档重试
    if (Math.abs(back.c - C) < 0.02 || C < 0.004) return hex
    C *= 0.85
  }
  return toHex(l, 0)
}

/** WCAG 相对亮度 */
export const relativeLuminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map((v) => srgbToLinear(v / 255))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/** WCAG 对比度（1~21） */
export const contrastRatio = (fg: string, bg: string): number => {
  const a = relativeLuminance(fg)
  const b = relativeLuminance(bg)
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

/** 把颜色压暗/提亮直到达到目标对比度（默认按暗色方向） */
export const ensureContrast = (hex: string, bg: string, target: number, dir: 'dark' | 'light' = 'dark'): string => {
  let { l, c, h } = hexToOklch(hex)
  let out = hex
  for (let i = 0; i < 40; i++) {
    if (contrastRatio(out, bg) >= target) return out
    l += dir === 'dark' ? -0.02 : 0.02
    l = Math.min(0.98, Math.max(0.06, l))
    // 明度降低时反向补彩度（Paletton 的 S+V 补偿原则）
    c = Math.min(0.3, c + (dir === 'dark' ? 0.004 : -0.003))
    out = oklchToHex(l, c, h)
  }
  return out
}

export const rotateHue = (h: number, deg: number) => (h + deg + 720) % 360
