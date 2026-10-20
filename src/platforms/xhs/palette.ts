/**
 * 主题色板派生：种子色 + 色相关系 + 纸色温度 → 完整 XhsPalette。
 *
 * 参考 Paletton 的取色逻辑：
 *   色轮定关系（单色 / 相似 / 邻近 / 互补 / 分裂 / 三角 / 四角）
 *   → 每个色族给出浅—深 5 阶（paletteRamps，面板展示）
 *   → 语义角色取色族中的稳定明度（accent / accent2 / accent3 / strong / italic）
 *   → WCAG 对比度校正（正文 ≥ 7、强调 ≥ 3）
 */
import { contrastRatio, ensureContrast, hexToOklch, oklchToHex, rotateHue } from '../../core/color'
import type { XhsPalette } from './theme'

export type ColorScheme = 'mono' | 'analogous' | 'neighbor' | 'complement' | 'split' | 'triadic' | 'tetrad'
export type PaperTone = 'warm' | 'cool'
export type PaletteTone = 'light' | 'dark'

export interface ColorPreset {
  id: string
  name: string
  seed: string
  scheme: ColorScheme
  paper: PaperTone
  /** 默认素笺：恢复主题自带色板，而不是派生 */
  isDefault?: boolean
}

export interface PaletteRamp {
  name: string
  colors: string[]
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const angleDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/** 色相关系 → 次色 / 第三色 / 第四色色相 */
const schemeHues = (h: number, scheme: ColorScheme) => {
  switch (scheme) {
    case 'mono':
      return { secondary: h, tertiary: h, quaternary: h }
    case 'analogous':
      return { secondary: rotateHue(h, 30), tertiary: rotateHue(h, -30), quaternary: rotateHue(h, 60) }
    case 'neighbor':
      return { secondary: rotateHue(h, 60), tertiary: rotateHue(h, -60), quaternary: rotateHue(h, 30) }
    case 'complement':
      return { secondary: rotateHue(h, 180), tertiary: rotateHue(h, 180), quaternary: rotateHue(h, 180) }
    case 'split':
      return { secondary: rotateHue(h, 150), tertiary: rotateHue(h, 210), quaternary: rotateHue(h, 180) }
    case 'triadic':
      return { secondary: rotateHue(h, 120), tertiary: rotateHue(h, 240), quaternary: rotateHue(h, 60) }
    case 'tetrad':
      // Paletton 常用矩形四色：70° / 180° / 250°
      return { secondary: rotateHue(h, 70), tertiary: rotateHue(h, 180), quaternary: rotateHue(h, 250) }
  }
}

export function derivePalette(seedHex: string, scheme: ColorScheme, paper: PaperTone, tone: PaletteTone = 'light'): XhsPalette {
  const seed = hexToOklch(seedHex)
  const hues = schemeHues(seed.h, scheme)
  const mono = scheme === 'mono'
  const chroma = clamp(seed.c, 0.14, 0.26)

  /* 纸色：暖纸偏黄、冷纸偏蓝，明度尽量高、彩度极低 */
  const paperHue = paper === 'warm' ? 85 : 250
  const bg = tone === 'light' ? oklchToHex(0.977, paper === 'warm' ? 0.013 : 0.009, paperHue) : oklchToHex(0.16, 0.012, paperHue)
  const dir = tone === 'light' ? 'dark' : 'light'
  const mk = (l: number, c: number, hue: number, need: number) => ensureContrast(oklchToHex(l, c, hue), bg, need, dir)

  if (tone === 'dark') {
    return {
      bg,
      heading: mk(0.97, 0.01, seed.h, 10),
      text: mk(0.88, 0.008, seed.h, 7),
      muted: mk(0.62, 0.012, seed.h, 3.2),
      accent: mk(0.7, clamp(chroma * 1.05, 0.16, 0.28), seed.h, 4.5),
      accent2: mk(mono ? 0.78 : 0.74, clamp(chroma * 0.85, 0.12, 0.24), hues.secondary, 3),
      accent3: mk(mono ? 0.64 : 0.68, clamp(chroma * 0.8, 0.12, 0.22), hues.tertiary, 3),
      strong: mk(0.78, chroma, seed.h, 5),
      italic: mk(0.8, clamp(chroma * 0.6, 0.08, 0.18), hues.secondary, 3),
      quoteBg: oklchToHex(0.23, 0.03, hues.secondary),
      codeBg: oklchToHex(0.19, 0.012, seed.h),
      codeFg: oklchToHex(0.9, 0.01, paperHue),
    }
  }

  return {
    bg,
    heading: mk(0.2, 0.012, seed.h, 9),
    text: mk(0.3, 0.008, seed.h, 7),
    muted: mk(0.56, 0.012, seed.h, 3.2),
    accent: mk(0.58, clamp(chroma, 0.16, 0.28), seed.h, 3),
    accent2: mk(mono ? 0.64 : 0.62, clamp(chroma * (mono ? 0.75 : 0.85), 0.12, 0.24), hues.secondary, 3),
    accent3: mk(mono ? 0.46 : 0.54, clamp(chroma * (mono ? 0.9 : 0.8), 0.12, 0.22), hues.tertiary, 3),
    strong: mk(0.48, chroma, seed.h, 4.5),
    italic: mk(0.68, clamp(chroma * 0.7, 0.08, 0.18), hues.secondary, 3),
    quoteBg: oklchToHex(0.955, 0.03, hues.secondary),
    codeBg: oklchToHex(0.22, 0.015, seed.h),
    codeFg: oklchToHex(0.94, 0.01, paperHue),
  }
}

/** 面板用：每个色族 5 阶（浅→深）；单色/互补自动去重 */
export function paletteRamps(seedHex: string, scheme: ColorScheme, _paper: PaperTone, tone: PaletteTone = 'light'): PaletteRamp[] {
  const seed = hexToOklch(seedHex)
  const hues = schemeHues(seed.h, scheme)
  const mono = scheme === 'mono'
  const named = [
    { h: seed.h, name: '主色' },
    { h: hues.secondary, name: scheme === 'complement' ? '互补色' : mono ? '主色' : '次色' },
    { h: hues.tertiary, name: mono ? '主色' : '第三色' },
    { h: hues.quaternary, name: mono ? '主色' : '第四色' },
  ]
  const unique: Array<{ h: number; name: string }> = []
  for (const item of named) {
    if (unique.some((u) => angleDiff(u.h, item.h) < 3)) continue
    unique.push(item)
  }
  const Ls = tone === 'dark' ? [0.3, 0.42, 0.56, 0.72, 0.86] : [0.94, 0.85, 0.72, 0.56, 0.4]
  const Cs = tone === 'dark' ? [0.03, 0.07, 0.11, 0.14, 0.12] : [0.03, 0.07, 0.13, 0.19, 0.17]
  return unique.map((u) => ({
    name: u.name,
    colors: Ls.map((l, i) => oklchToHex(l, Cs[i]!, u.h)),
  }))
}

/**
 * 从当前语义色板反推色族：面板展示的色族与卡片实际用色一致，
 * 不依赖本地 seed/scheme 状态（画廊应用预设后也不会错位）。
 */
export function paletteRampsFromPalette(pal: XhsPalette, tone: PaletteTone = 'light'): PaletteRamp[] {
  const roles = [
    { hex: pal.accent, name: '主色' },
    { hex: pal.accent2 ?? pal.italic, name: '次色' },
    { hex: pal.accent3 ?? pal.strong, name: '第三色' },
    { hex: pal.strong, name: '强调' },
  ]
  const unique: Array<{ h: number; name: string }> = []
  for (const role of roles) {
    const { h } = hexToOklch(role.hex)
    if (unique.some((u) => angleDiff(u.h, h) < 3)) continue
    unique.push({ h, name: role.name })
  }
  const Ls = tone === 'dark' ? [0.3, 0.42, 0.56, 0.72, 0.86] : [0.94, 0.85, 0.72, 0.56, 0.4]
  const Cs = tone === 'dark' ? [0.03, 0.07, 0.11, 0.14, 0.12] : [0.03, 0.07, 0.13, 0.19, 0.17]
  return unique.map((u) => ({ name: u.name, colors: Ls.map((l, i) => oklchToHex(l, Cs[i]!, u.h)) }))
}

/** 色相关系的中文标签与解释 */
export const SCHEMES: Array<{ id: ColorScheme; label: string; hint: string }> = [
  { id: 'mono', label: '单色', hint: '同一色相，用明度与彩度分层' },
  { id: 'analogous', label: '相似', hint: '色相 ±30°，柔和、统一' },
  { id: 'neighbor', label: '邻近', hint: '色相 ±60°，比相似更有变化' },
  { id: 'complement', label: '互补', hint: '180° 对色，冷暖对比最强' },
  { id: 'split', label: '分裂', hint: '150° / 210°，互补的柔化版' },
  { id: 'triadic', label: '三角', hint: '120° / 240°，三种性格' },
  { id: 'tetrad', label: '四角', hint: '70° / 180° / 250°，四色组' },
]

/**
 * 配色方案库：
 * - 素笺是默认（恢复主题色板）；
 * - 其余覆盖单色/相似/邻近/互补/分裂/三角/四角。
 */
export const COLOR_PRESETS: ColorPreset[] = [
  { id: 'sujian', name: '素笺', seed: '#ff2e4d', scheme: 'complement', paper: 'warm', isDefault: true },
  { id: 'chase-mono', name: '茶褐', seed: '#b35c44', scheme: 'mono', paper: 'warm' },
  { id: 'qingci-mono', name: '青瓷', seed: '#3f7f7a', scheme: 'mono', paper: 'cool' },
  { id: 'zhuqing', name: '竹青', seed: '#789262', scheme: 'analogous', paper: 'warm' },
  { id: 'rouge', name: '胭脂', seed: '#9d2933', scheme: 'analogous', paper: 'warm' },
  { id: 'songhua', name: '松花', seed: '#bce672', scheme: 'neighbor', paper: 'warm' },
  { id: 'jiangzi', name: '绛紫', seed: '#8c4356', scheme: 'neighbor', paper: 'warm' },
  { id: 'zhusha', name: '朱砂', seed: '#ff461f', scheme: 'complement', paper: 'warm' },
  { id: 'dailan', name: '黛蓝', seed: '#425066', scheme: 'complement', paper: 'cool' },
  { id: 'qiuxiang', name: '秋香', seed: '#d9b611', scheme: 'split', paper: 'warm' },
  { id: 'rose', name: '玫', seed: '#ff2e4d', scheme: 'triadic', paper: 'warm' },
  { id: 'xuanzi', name: '玄紫', seed: '#622870', scheme: 'tetrad', paper: 'cool' },
]

/** 兼容旧命名 */
export const CLASSICAL_COLORS = COLOR_PRESETS

export const paletteOf = (preset: ColorPreset, tone: PaletteTone = 'light') => derivePalette(preset.seed, preset.scheme, preset.paper, tone)

/** 给面板做对比度提示用 */
export const contrastOf = (fg: string, bg: string) => Math.round(contrastRatio(fg, bg) * 10) / 10
