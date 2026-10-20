import { CLASSICAL_COLORS, paletteOf, type XhsStyleOverrides } from '../platforms/xhs'

export interface GalleryPreset {
  id: string
  name: string
  note: string
  themeId: string
  /** 古典色预设 id（可选） */
  colorId?: string
  /** 明暗：暗色预设的缩略图会斜切展示明/暗两版 */
  tone?: 'light' | 'dark'
  overrides: XhsStyleOverrides
  kind: 'style' | 'cover'
}

/** 风格预设：只改版式与配色，不动正文内容 */
export const STYLE_PRESETS: GalleryPreset[] = [
  {
    id: 'sujian',
    name: '素笺',
    note: '暖白纸，玫红一句',
    themeId: 'clean',
    overrides: {},
    kind: 'style',
  },
  {
    id: 'bamboo-clean',
    name: '竹青',
    note: '冷绿纸，左竖条标题',
    themeId: 'clean',
    colorId: 'zhuqing',
    overrides: { headings: { h2: { decoration: 'bar' } } },
    kind: 'style',
  },
  {
    id: 'xuanmo',
    name: '玄墨',
    note: '冷蓝暗底，明暗对照',
    themeId: 'clean',
    colorId: 'shenhai',
    tone: 'dark',
    overrides: { headings: { h2: { decoration: 'dots' } } },
    kind: 'style',
  },
  {
    id: 'rouge-book',
    name: '胭脂',
    note: '暖红纸，下划线标题',
    themeId: 'clean',
    colorId: 'rouge',
    overrides: { headings: { h2: { decoration: 'underline' } } },
    kind: 'style',
  },
  {
    id: 'indigo-rational',
    name: '黛蓝',
    note: '冷蓝纸，左对齐',
    themeId: 'clean',
    colorId: 'dailan',
    overrides: { body: { align: 'left' }, headings: { h2: { decoration: 'underline' } } },
    kind: 'style',
  },
  {
    id: 'yelan',
    name: '夜阑',
    note: '暗红纸，明暗对照',
    themeId: 'clean',
    colorId: 'yelan',
    tone: 'dark',
    overrides: { headings: { h2: { decoration: 'twin' } } },
    kind: 'style',
  },
  {
    id: 'tea-twin',
    name: '宣纸',
    note: '暖棕纸，双子塔标题',
    themeId: 'clean',
    colorId: 'xuanzhi',
    overrides: { headings: { h2: { decoration: 'twin' } } },
    kind: 'style',
  },
  {
    id: 'songhua-pill',
    name: '青瓷',
    note: '青蓝纸，胶囊标题',
    themeId: 'clean',
    colorId: 'qingci',
    overrides: { headings: { h2: { decoration: 'pill', align: 'center' } } },
    kind: 'style',
  },
  {
    id: 'xuanzi-tetrad',
    name: '玄紫',
    note: '冷紫纸，双侧线标题',
    themeId: 'clean',
    colorId: 'xuanzi',
    overrides: { headings: { h2: { decoration: 'flank', align: 'center' } } },
    kind: 'style',
  },
]

/** 封面模板：只覆盖封面相关参数，文案沿用当前内容 */
export const COVER_TEMPLATES: GalleryPreset[] = [
  {
    id: 'cover-classic-top',
    name: '经典·上置',
    note: '标题靠近天头',
    themeId: 'clean',
    overrides: { coverOn: true, coverStyle: 'classic', cover: 'top', coverTitleSize: 84 },
    kind: 'cover',
  },
  {
    id: 'cover-classic-center',
    name: '经典·居中',
    note: '纸感留白，标题居中',
    themeId: 'clean',
    overrides: { coverOn: true, coverStyle: 'classic', cover: 'center', coverTitleSize: 88 },
    kind: 'cover',
  },
  {
    id: 'cover-classic-bottom',
    name: '经典·下置',
    note: '标题落在下三分之一',
    themeId: 'clean',
    overrides: { coverOn: true, coverStyle: 'classic', cover: 'bottom', coverTitleSize: 84 },
    kind: 'cover',
  },
  {
    id: 'cover-editorial',
    name: '左齐·杂志',
    note: '报头 + 左对齐标题',
    themeId: 'clean',
    overrides: {
      coverOn: true,
      coverStyle: 'editorial',
      coverTitleSize: 84,
      coverPadding: { top: 120, right: 96, bottom: 110, left: 96 },
    },
    kind: 'cover',
  },
  {
    id: 'cover-vertical',
    name: '竖排·右起',
    note: '直排标题，右起阅读',
    themeId: 'clean',
    overrides: { coverOn: true, coverStyle: 'vertical', coverTitleSize: 92 },
    kind: 'cover',
  },
  {
    id: 'cover-jacket',
    name: '书封·内框',
    note: '细线内框，居中书名',
    themeId: 'clean',
    overrides: { coverOn: true, coverStyle: 'jacket', coverTitleSize: 78 },
    kind: 'cover',
  },
  {
    id: 'cover-big-full',
    name: '巨字·压满',
    note: '大字压满，适合观点',
    themeId: 'clean',
    overrides: { coverOn: true, coverStyle: 'big', coverTitleSize: 120 },
    kind: 'cover',
  },
  {
    id: 'cover-big-light',
    name: '巨字·轻压',
    note: '大字但留出呼吸',
    themeId: 'clean',
    overrides: { coverOn: true, coverStyle: 'big', coverTitleSize: 96 },
    kind: 'cover',
  },
  {
    id: 'cover-index',
    name: '索引·目录',
    note: '目录式封面，信息型内容',
    themeId: 'clean',
    overrides: { coverOn: true, coverStyle: 'index', coverTitleSize: 72 },
    kind: 'cover',
  },
]

/** 把古典色合入 overrides（palette 是完整色板，不是主题名） */
export function resolvePreset(preset: GalleryPreset): XhsStyleOverrides {
  const color = preset.colorId ? CLASSICAL_COLORS.find((c) => c.id === preset.colorId) : undefined
  return color ? { ...preset.overrides, palette: paletteOf(color, preset.tone ?? 'light') } : preset.overrides
}
