/**
 * 小红书主题模型。
 * 核心：卡片样式由「排版参数」驱动（类比 LaTeX / Word）——
 * 页边距、行距、段距、字间距、段前标题空间，而非散装的视觉魔法数字。
 * 主题 = 纯数据（JSON 序列化，可导入导出/分享），不含任何行为。
 */

export const XHS_CARD_SIZES = {
  '3:4': { width: 1080, height: 1440 }, // 小红书官方推荐
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
} as const

export type XhsCardSizeName = keyof typeof XHS_CARD_SIZES

/** 页内边距（类比 Word/LaTeX 的页边距） */
export interface XhsPadding {
  top: number
  right: number
  bottom: number
  left: number
}

/** 排版度量（样式的唯一事实来源，渲染与测高分页都必须消费同一组值） */
export interface XhsTypography {
  /** 正文字号 */
  bodySize: number
  /** 一级标题字号（h2/h3 按比例缩小） */
  headingSize: number
  /** 行距（行高/字号 比，类比 Word 的 1.5 倍行距） */
  lineRatio: number
  /** 字间距 */
  letterSpacing: number
  /** 段间距（paragraph spacing） */
  paragraphSpacing: number
  /** 标题段前空间（类比 \section spacing） */
  headingSpaceBefore: number
  /** 标题段后空间 */
  headingSpaceAfter: number
}

export interface XhsPalette {
  bg: string
  text: string
  heading: string
  accent: string
  muted: string
  quoteBg: string
  codeBg: string
  codeFg: string
}

export interface XhsCardTheme {
  id: string
  name: string
  fontFamily: string
  page: { padding: XhsPadding; typography: XhsTypography }
  palette: XhsPalette
  /** 背景圆角（导出四角圆弧） */
  radius: number
  watermark: { enabled: boolean; text: string }
  /** 列表项符，'' 则用序号 */
  bulletSymbol: string
}

const FONT_SANS = 'PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif'
const FONT_SERIF = '"Source Han Serif SC", "Noto Serif SC", SimSun, serif'

const baseTypography = {
  bodySize: 38,
  headingSize: 58,
  lineRatio: 1.7,
  letterSpacing: 0.5,
  paragraphSpacing: 26,
  headingSpaceBefore: 44,
  headingSpaceAfter: 18,
}

export const XHS_THEMES: XhsCardTheme[] = [
  {
    id: 'clean',
    name: '清爽版',
    fontFamily: FONT_SANS,
    page: {
      padding: { top: 96, right: 88, bottom: 96, left: 88 },
      typography: { ...baseTypography },
    },
    palette: {
      bg: '#fdfcf8',
      text: '#3a3a3a',
      heading: '#1f1f1f',
      accent: '#ff2e4d',
      muted: '#9a9a94',
      quoteBg: '#f2efe8',
      codeBg: '#2f2f2f',
      codeFg: '#f5f2ea',
    },
    radius: 24,
    watermark: { enabled: true, text: '@md2pub' },
    bulletSymbol: '•',
  },
  {
    id: 'magazine',
    name: '文艺杂志版',
    fontFamily: FONT_SERIF,
    page: {
      padding: { top: 104, right: 96, bottom: 104, left: 96 },
      typography: { ...baseTypography, bodySize: 36, headingSize: 54, lineRatio: 1.8, letterSpacing: 1.2, paragraphSpacing: 30 },
    },
    palette: {
      bg: '#f6f1e7',
      text: '#4a4238',
      heading: '#2b2418',
      accent: '#c2703d',
      muted: '#a89f8d',
      quoteBg: '#ece4d4',
      codeBg: '#3b3025',
      codeFg: '#f0e8d8',
    },
    radius: 8,
    watermark: { enabled: true, text: '@md2pub' },
    bulletSymbol: '◦',
  },
  {
    id: 'dark',
    name: '暗夜版',
    fontFamily: FONT_SANS,
    page: {
      padding: { top: 96, right: 88, bottom: 96, left: 88 },
      typography: { ...baseTypography, paragraphSpacing: 28 },
    },
    palette: {
      bg: '#191b22',
      text: '#d8dce4',
      heading: '#ffffff',
      accent: '#7ce0c3',
      muted: '#71798a',
      quoteBg: '#232631',
      codeBg: '#262a36',
      codeFg: '#e6eaf2',
    },
    radius: 24,
    watermark: { enabled: true, text: '@md2pub' },
    bulletSymbol: '▸',
  },
]

export const getTheme = (id: string): XhsCardTheme =>
  XHS_THEMES.find(t => t.id === id) ?? XHS_THEMES[0]!

/**
 * 用户在 UI 里对主题的微调（排版参数面板）。
 * 合成规则：以所选主题为底，覆盖已知字段；保持纯数据。
 */
export interface XhsStyleOverrides {
  padding?: Partial<XhsPadding>
  typography?: Partial<XhsTypography>
}

export function applyXhsOverrides(base: XhsCardTheme, overrides: XhsStyleOverrides): XhsCardTheme {
  return {
    ...base,
    page: {
      padding: { ...base.page.padding, ...overrides.padding },
      typography: { ...base.page.typography, ...overrides.typography },
    },
  }
}

/** 内容可用区派生常量：页眉行高 & 页脚水印预留 */
export const XHS_HEADER_HEIGHT = 56
export const XHS_FOOTER_RESERVE = 56

/** 给定尺寸与主题时的内容可用区：测高分页与内容渲染共用这里派生 */
export function computeContentMetrics(size: { width: number; height: number }, theme: XhsCardTheme) {
  const { padding, typography } = theme.page
  const contentWidth = size.width - padding.left - padding.right
  const availableHeight =
    size.height - padding.top - padding.bottom - XHS_HEADER_HEIGHT - XHS_FOOTER_RESERVE
  return { contentWidth, availableHeight, typography }
}
