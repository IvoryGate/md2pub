/**
 * 主题色板派生：种子色 + 色相关系 + 纸色温度 → 完整 XhsPalette。
 *
 * 依据《色彩搭配原理》的链路：
 *   色轮定关系（单色/类似/互补/分裂/三等分）
 *   → OKLCH 定明度与彩度
 *   → 明度建层级、彩度反向补偿（Paletton 的 S+V 补偿原则）
 *   → WCAG 对比度验证（正文 ≥ 7、强调 ≥ 3）
 */
import { contrastRatio, ensureContrast, hexToOklch, oklchToHex, rotateHue } from '../../core/color'
import type { XhsPalette } from './theme'

export type ColorScheme = 'mono' | 'analogous' | 'complement' | 'split' | 'triadic'
export type PaperTone = 'warm' | 'cool'
export type PaletteTone = 'light' | 'dark'

export interface ColorPreset {
  id: string
  name: string
  seed: string
  scheme: ColorScheme
  paper: PaperTone
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** 色相关系 → 次色（italic）/ 第三色（strong）的色相偏移 */
const schemeHues = (h: number, scheme: ColorScheme) => {
  switch (scheme) {
    case 'mono':
      return { secondary: h, tertiary: h }
    case 'analogous':
      return { secondary: rotateHue(h, 30), tertiary: rotateHue(h, -18) }
    case 'complement':
      return { secondary: rotateHue(h, 180), tertiary: h }
    case 'split':
      return { secondary: rotateHue(h, 150), tertiary: rotateHue(h, 210) }
    case 'triadic':
      return { secondary: rotateHue(h, 120), tertiary: rotateHue(h, 240) }
  }
}

export function derivePalette(seedHex: string, scheme: ColorScheme, paper: PaperTone, tone: PaletteTone = 'light'): XhsPalette {
  const seed = hexToOklch(seedHex)
  const hues = schemeHues(seed.h, scheme)

  /* 纸色：暖纸偏黄、冷纸偏蓝，明度尽量高、彩度极低 */
  const paperHue = paper === 'warm' ? 85 : 250
  const bg = oklchToHex(0.977, paper === 'warm' ? 0.013 : 0.009, paperHue)

  /* 强调色：保留种子色相，明度/彩度收敛到可用区间，再验证对比度 */
  const accentBase = oklchToHex(clamp(seed.l, 0.54, 0.66), clamp(Math.max(seed.c, 0.14), 0.14, 0.23), seed.h)
  const accent = ensureContrast(accentBase, bg, 3, 'dark')

  /* 墨色层级：标题最深、正文次之、次要再浅；全部做对比度校验 */
  const heading = ensureContrast(oklchToHex(0.2, 0.012, seed.h), bg, 9, 'dark')
  const text = ensureContrast(oklchToHex(0.3, 0.008, seed.h), bg, 7, 'dark')
  const muted = ensureContrast(oklchToHex(0.56, 0.012, seed.h), bg, 3.2, 'dark')

  /* 加粗 = 强调色族（同色相、更深、更饱和）；斜体 = 方案次色（承担色相变化） */
  const strong = ensureContrast(oklchToHex(0.5, clamp(seed.c * 1.15, 0.14, 0.26), rotateHue(seed.h, 6)), bg, 4.5, 'dark')
  const italic = ensureContrast(oklchToHex(0.72, clamp(seed.c * 0.55, 0.06, 0.12), hues.secondary), bg, 3, 'dark')

  const quoteBg = oklchToHex(0.965, 0.02, seed.h)
  const codeBg = oklchToHex(0.25, 0.012, seed.h)
  const codeFg = oklchToHex(0.95, 0.01, paperHue)

  if (tone === 'dark') {
    /* 暗色模式：纸色压到 L≈0.17，墨色提亮；对比度按「亮字/暗底」校验 */
    const dbg = oklchToHex(0.17, 0.012, paper === 'warm' ? 70 : 250)
    const dHeading = ensureContrast(oklchToHex(0.97, 0.01, seed.h), dbg, 10, 'light')
    const dText = ensureContrast(oklchToHex(0.88, 0.008, seed.h), dbg, 7, 'light')
    const dMuted = ensureContrast(oklchToHex(0.62, 0.012, seed.h), dbg, 3.2, 'light')
    const dAccent = ensureContrast(oklchToHex(clamp(seed.l, 0.6, 0.74), clamp(Math.max(seed.c, 0.14), 0.14, 0.23), seed.h), dbg, 4.5, 'light')
    const dStrong = ensureContrast(oklchToHex(0.76, clamp(seed.c * 1.1, 0.14, 0.26), rotateHue(seed.h, 6)), dbg, 5, 'light')
    const dItalic = ensureContrast(oklchToHex(0.8, clamp(seed.c * 0.55, 0.06, 0.14), hues.secondary), dbg, 3, 'light')
    return {
      bg: dbg,
      text: dText,
      heading: dHeading,
      accent: dAccent,
      muted: dMuted,
      quoteBg: oklchToHex(0.23, 0.02, seed.h),
      codeBg: oklchToHex(0.2, 0.012, seed.h),
      codeFg: oklchToHex(0.9, 0.01, paperHue),
      strong: dStrong,
      italic: dItalic,
    }
  }

  return { bg, text, heading, accent, muted, quoteBg, codeBg, codeFg, strong, italic }
}

/** 古典色（中国传统色）种子；统一走派生器，保证可读性 */
export const CLASSICAL_COLORS: ColorPreset[] = [
  { id: 'rose', name: '清爽·玫', seed: '#ff2e4d', scheme: 'complement', paper: 'warm' },
  { id: 'rouge', name: '胭脂', seed: '#9d2933', scheme: 'complement', paper: 'warm' },
  { id: 'zhusha', name: '朱砂', seed: '#ff461f', scheme: 'complement', paper: 'warm' },
  { id: 'jiangzi', name: '绛紫', seed: '#8c4356', scheme: 'analogous', paper: 'warm' },
  { id: 'zhuqing', name: '竹青', seed: '#789262', scheme: 'analogous', paper: 'warm' },
  { id: 'dailan', name: '黛蓝', seed: '#425066', scheme: 'complement', paper: 'cool' },
  { id: 'qiuxiang', name: '秋香', seed: '#d9b611', scheme: 'split', paper: 'warm' },
  { id: 'chasе', name: '茶色', seed: '#b35c44', scheme: 'mono', paper: 'warm' },
  { id: 'songhua', name: '松花', seed: '#bce672', scheme: 'split', paper: 'warm' },
]

export const paletteOf = (preset: ColorPreset, tone: PaletteTone = 'light') => derivePalette(preset.seed, preset.scheme, preset.paper, tone)

/** 给面板做对比度提示用 */
export const contrastOf = (fg: string, bg: string) => Math.round(contrastRatio(fg, bg) * 10) / 10
