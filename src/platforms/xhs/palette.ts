/**
 * 配色系统：
 * - 预设是一套完整色板（纸色、墨色、主色、第二色、第三色），纸张和文字都带明确色相；
 * - 配色工具用 Paletton 式的关系环（单色/相似/邻近/互补/分裂/三角/四角）派生；
 * - 色板条按 OKLCH 明度阶生成，保证不同色相有一致的明暗层级。
 */
import { contrastRatio, ensureContrast, hexToOklch, oklchToHex, rotateHue } from '../../core/color'
import type { XhsPalette } from './theme'

export type ColorScheme = 'mono' | 'analogous' | 'neighbor' | 'complement' | 'split' | 'triadic' | 'tetrad'
export type PaperTone = 'warm' | 'cool'
export type PaletteTone = 'light' | 'dark'

export interface ColorPreset {
  id: string
  name: string
  /** 纸张 / 墨色 / 主色 / 第二色 / 第三色 */
  paper: string
  ink: string
  primary: string
  secondary: string
  tertiary: string
  quaternary?: string
  /** 默认素笺：恢复主题自带色板 */
  isDefault?: boolean
  /** 暗色预设（缩略图用明暗斜切） */
  dark?: boolean
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

const mixOklch = (a: string, b: string, t: number) => {
  const ca = hexToOklch(a)
  const cb = hexToOklch(b)
  return oklchToHex(ca.l + (cb.l - ca.l) * t, ca.c + (cb.c - ca.c) * t, ca.h + (cb.h - ca.h) * t)
}

/** 从五个关键色生成完整语义色板 */
function paletteFromKeys(
  keys: Pick<ColorPreset, 'paper' | 'ink' | 'primary' | 'secondary' | 'tertiary' | 'quaternary'>,
): XhsPalette {
  const { paper, ink, primary, secondary, tertiary, quaternary } = keys
  const dark = contrastRatio(paper, '#000000') < 2.6
  const dir = dark ? 'light' : 'dark'
  const ph = hexToOklch(paper).h
  const ih = hexToOklch(ink).h
  const pri = hexToOklch(primary)
  const sec = hexToOklch(secondary)

  return {
    bg: paper,
    heading: ensureContrast(oklchToHex(dark ? 0.97 : 0.19, 0.025, ih), paper, 9, dir),
    text: ensureContrast(ink, paper, 7, dir),
    muted: ensureContrast(mixOklch(ink, paper, dark ? 0.55 : 0.5), paper, 3.2, dir),
    accent: ensureContrast(primary, paper, 3, dir),
    accent2: ensureContrast(secondary, paper, 3, dir),
    accent3: ensureContrast(tertiary, paper, 3, dir),
    accent4: quaternary ? ensureContrast(quaternary, paper, 3, dir) : undefined,
    strong: ensureContrast(oklchToHex(dark ? 0.78 : 0.44, clamp(pri.c, 0.1, 0.2), pri.h), paper, 4.5, dir),
    italic: ensureContrast(secondary, paper, 3, dir),
    quoteBg: oklchToHex(dark ? 0.235 : 0.95, 0.028, sec.h),
    codeBg: oklchToHex(dark ? 0.15 : 0.2, 0.015, ph),
    codeFg: ensureContrast(oklchToHex(0.93, 0.01, ph), oklchToHex(dark ? 0.15 : 0.2, 0.015, ph), 7, 'light'),
  }
}

/** 显式预设的明/暗变体：供画廊斜切预览与明暗切换使用 */
export const paletteOf = (preset: ColorPreset, tone: PaletteTone = 'light') => {
  if (preset.isDefault) {
    const keys = { paper: '#fcf9f2', ink: '#3a3a3a', primary: '#ff2e4d', secondary: '#bd93f9', tertiary: '#e91e63' }
    if (tone === 'dark') {
      const h = hexToOklch(keys.primary).h
      return paletteFromKeys({ ...keys, paper: oklchToHex(0.18, 0.03, h), ink: oklchToHex(0.92, 0.03, h) })
    }
    return paletteFromKeys(keys)
  }
  if (preset.dark && tone === 'light') {
    const h = hexToOklch(preset.primary).h
    return paletteFromKeys({
      ...preset,
      paper: oklchToHex(0.955, 0.04, h),
      ink: oklchToHex(0.25, 0.04, h),
    })
  }
  if (!preset.dark && tone === 'dark') {
    const h = hexToOklch(preset.primary).h
    return paletteFromKeys({
      ...preset,
      paper: oklchToHex(0.18, 0.03, h),
      ink: oklchToHex(0.92, 0.03, h),
    })
  }
  return paletteFromKeys(preset)
}

/** 预设配色：赤橙黄绿青蓝紫 + 双色/三色 + 冷暖/明暗 */
export const COLOR_PRESETS: ColorPreset[] = [
  { id: 'sujian', name: '素笺', paper: '#fcf9f2', ink: '#3a3a3a', primary: '#ff2e4d', secondary: '#bd93f9', tertiary: '#e91e63', isDefault: true },
  { id: 'zhusha', name: '朱砂', paper: '#f7e6e2', ink: '#3a1e1a', primary: '#c8322a', secondary: '#7d2f2a', tertiary: '#d98a5f' },
  { id: 'hupo', name: '琥珀', paper: '#f8eedb', ink: '#3a2a17', primary: '#d9822b', secondary: '#80532a', tertiary: '#e8b76a' },
  { id: 'qiuxiang', name: '秋香', paper: '#f8f2d9', ink: '#35301c', primary: '#c9a227', secondary: '#6d6b2b', tertiary: '#e3cd6b' },
  { id: 'zhuqing', name: '竹青', paper: '#e9f0e1', ink: '#24352a', primary: '#4f8a5b', secondary: '#2f5d4a', tertiary: '#a3c293' },
  { id: 'qingci', name: '青瓷', paper: '#e3f0ee', ink: '#1e3534', primary: '#2f8f8a', secondary: '#1f5f66', tertiary: '#8cc9c0' },
  { id: 'dailan', name: '黛蓝', paper: '#e4ebf6', ink: '#1c2940', primary: '#3b6fd4', secondary: '#1f3f73', tertiary: '#8fb3e6' },
  { id: 'xuanzi', name: '玄紫', paper: '#efe5f4', ink: '#2b1d3a', primary: '#7b4ea3', secondary: '#4a2f66', tertiary: '#b99bd6' },
  { id: 'rouge', name: '胭脂', paper: '#f7e4e8', ink: '#3a1f2a', primary: '#b23a5e', secondary: '#7a2c4a', tertiary: '#d98aa3' },
  { id: 'yelan', name: '夜阑', paper: '#1c1a20', ink: '#e8e2db', primary: '#d86a5a', secondary: '#8c3f4a', tertiary: '#e0a06a', dark: true },
  { id: 'shenhai', name: '深海', paper: '#0f1b21', ink: '#dbe8e8', primary: '#4bb3b0', secondary: '#2b6f78', tertiary: '#86d0c8', dark: true },
  { id: 'songyan', name: '松烟', paper: '#f0ebde', ink: '#25332c', primary: '#3c5a4a', secondary: '#c17a4b', tertiary: '#8a9a7a' },
  { id: 'ni', name: '霓', paper: '#f3edf4', ink: '#2a2235', primary: '#5b4bd6', secondary: '#e06b6b', tertiary: '#3aa6a0' },
  { id: 'wulan', name: '雾蓝', paper: '#edf2f7', ink: '#2b3440', primary: '#7893b8', secondary: '#4f6d8f', tertiary: '#b8c9da' },
  { id: 'xuanzhi', name: '宣纸', paper: '#f6efe2', ink: '#3a2f25', primary: '#a8744f', secondary: '#6b4a34', tertiary: '#d4b48c' },
]

/** 兼容旧命名 */
export const CLASSICAL_COLORS = COLOR_PRESETS

/** ======================= 配色工具（Paletton 式） ======================= */

const schemeHues = (h: number, scheme: ColorScheme, distance = 30) => {
  switch (scheme) {
    case 'mono':
      return { secondary: h, tertiary: h, quaternary: h }
    case 'analogous':
      return { secondary: rotateHue(h, distance), tertiary: rotateHue(h, -distance), quaternary: rotateHue(h, distance * 2) }
    case 'neighbor':
      return { secondary: rotateHue(h, distance * 2), tertiary: rotateHue(h, -distance * 2), quaternary: rotateHue(h, distance) }
    case 'complement':
      return { secondary: rotateHue(h, 180), tertiary: rotateHue(h, 180), quaternary: rotateHue(h, 180) }
    case 'split':
      return { secondary: rotateHue(h, 180 - distance), tertiary: rotateHue(h, 180 + distance), quaternary: rotateHue(h, 180) }
    case 'triadic':
      return { secondary: rotateHue(h, 120), tertiary: rotateHue(h, 240), quaternary: rotateHue(h, 60) }
    case 'tetrad':
      return { secondary: rotateHue(h, distance), tertiary: rotateHue(h, 180), quaternary: rotateHue(h, 180 + distance) }
  }
}

/** 从种子色 + 关系派生：纸张/文字都带种子色相，保证一套配色在卡片上明显成立 */
export function derivePalette(
  seedHex: string,
  scheme: ColorScheme,
  _paper: PaperTone,
  tone: PaletteTone = 'light',
  distance = 30,
): XhsPalette {
  const seed = hexToOklch(seedHex)
  const hues = schemeHues(seed.h, scheme, distance)
  const dark = tone === 'dark'
  const paper = oklchToHex(dark ? 0.18 : 0.955, dark ? 0.03 : 0.04, seed.h)
  const ink = oklchToHex(dark ? 0.92 : 0.25, 0.035, seed.h)
  const chroma = clamp(seed.c, 0.16, 0.3)
  const primary = oklchToHex(dark ? 0.7 : 0.58, chroma, seed.h)
  const secondary = oklchToHex(dark ? 0.74 : 0.6, chroma * 0.85, hues.secondary)
  const tertiary = oklchToHex(dark ? 0.68 : 0.52, chroma * 0.8, hues.tertiary)
  const quaternary = scheme === 'tetrad' ? oklchToHex(dark ? 0.7 : 0.56, chroma * 0.7, hues.quaternary) : undefined
  return paletteFromKeys({ paper, ink, primary, secondary, tertiary, quaternary })
}

export const SCHEMES: Array<{ id: ColorScheme; label: string; hint: string }> = [
  { id: 'mono', label: '单色', hint: '同一色相，用明度与彩度分层' },
  { id: 'analogous', label: '相似', hint: '色相 ±30°，柔和、统一' },
  { id: 'neighbor', label: '邻近', hint: '色相 ±60°，比相似更有变化' },
  { id: 'complement', label: '互补', hint: '180° 对色，冷暖对比最强' },
  { id: 'split', label: '分裂', hint: '180° ± 间距，互补的柔化版' },
  { id: 'triadic', label: '三角', hint: '120° / 240°，三种性格' },
  { id: 'tetrad', label: '四角', hint: '间距 / 180° / 180°+间距（默认 70°），四色组' },
]

/** 从一个实际色板取色族（去重），用于色条 */
export function paletteRampsFromPalette(pal: XhsPalette, tone: PaletteTone = 'light'): PaletteRamp[] {
  const roles = [
    { hex: pal.accent, name: '主色' },
    { hex: pal.accent2 ?? pal.italic, name: '第二色' },
    { hex: pal.accent3 ?? pal.strong, name: '第三色' },
    ...(pal.accent4 ? [{ hex: pal.accent4, name: '第四色' }] : []),
  ]
  const unique: Array<{ h: number; name: string }> = []
  for (const role of roles) {
    const { h } = hexToOklch(role.hex)
    if (unique.some((u) => angleDiff(u.h, h) < 3)) continue
    unique.push({ h, name: role.name })
  }
  const Ls = tone === 'dark' ? [0.3, 0.42, 0.56, 0.72, 0.86, 0.92, 0.96] : [0.94, 0.86, 0.76, 0.64, 0.52, 0.4, 0.28]
  const Cs = tone === 'dark' ? [0.03, 0.06, 0.1, 0.13, 0.12, 0.08, 0.04] : [0.03, 0.08, 0.14, 0.2, 0.22, 0.16, 0.1]
  return unique.map((u) => ({ name: u.name, colors: Ls.map((l, i) => oklchToHex(l, Cs[i]!, u.h)) }))
}

/** 7 阶中性色条（纸色 → 墨色），近似截图里的中性色卡 */
export function neutralStrip(pal: XhsPalette): string[] {
  const h = hexToOklch(pal.heading).h
  return [pal.bg, ...([0.9, 0.8, 0.65, 0.45, 0.3].map((l) => oklchToHex(l, 0.012, h))), pal.heading]
}

/** 给面板做对比度提示用 */
export const contrastOf = (fg: string, bg: string) => Math.round(contrastRatio(fg, bg) * 10) / 10
