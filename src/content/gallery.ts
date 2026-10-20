import { CLASSICAL_COLORS, paletteOf, type XhsStyleOverrides } from '../platforms/xhs'

export interface GalleryPreset {
  id: string
  name: string
  note: string
  themeId: string
  /** 古典色预设 id（可选） */
  colorId?: string
  overrides: XhsStyleOverrides
  kind: 'style' | 'cover'
}

/** 风格预设：只改版式与配色，不动正文内容 */
export const STYLE_PRESETS: GalleryPreset[] = [
  {
    id: 'sujian',
    name: '素笺',
    note: '默认的米白纸 + 玫红强调',
    themeId: 'clean',
    overrides: {},
    kind: 'style',
  },
  {
    id: 'rouge-book',
    name: '胭脂书卷',
    note: '低饱和胭脂 + 下划线标题',
    themeId: 'clean',
    colorId: 'rouge',
    overrides: { headings: { h2: { decoration: 'underline' } } },
    kind: 'style',
  },
  {
    id: 'bamboo-clean',
    name: '竹青清简',
    note: '竹青 + 左竖条标题',
    themeId: 'clean',
    colorId: 'zhuqing',
    overrides: { headings: { h2: { decoration: 'bar' } } },
    kind: 'style',
  },
  {
    id: 'indigo-rational',
    name: '黛蓝理性',
    note: '冷纸、黛蓝、左对齐',
    themeId: 'clean',
    colorId: 'dailan',
    overrides: { body: { align: 'left' }, headings: { h2: { decoration: 'underline' } } },
    kind: 'style',
  },
  {
    id: 'zhusha-focus',
    name: '朱砂重点',
    note: '高对比朱砂 + 三点标题',
    themeId: 'clean',
    colorId: 'zhusha',
    overrides: { headings: { h2: { decoration: 'dots' } } },
    kind: 'style',
  },
  {
    id: 'songhua-pill',
    name: '松花题签',
    note: '浅绿纸 + 居中胶囊标题',
    themeId: 'clean',
    colorId: 'songhua',
    overrides: { headings: { h2: { decoration: 'pill', align: 'center' } } },
    kind: 'style',
  },
  {
    id: 'tea-twin',
    name: '茶褐双线',
    note: '暖棕纸 + 双子塔标题',
    themeId: 'clean',
    colorId: 'chase',
    overrides: { headings: { h2: { decoration: 'twin' } } },
    kind: 'style',
  },
  {
    id: 'purple-flank',
    name: '绛紫双侧',
    note: '绛紫 + 居中双侧线标题',
    themeId: 'clean',
    colorId: 'jiangzi',
    overrides: { headings: { h2: { decoration: 'flank', align: 'center' } } },
    kind: 'style',
  },
]

/** 封面模板：只覆盖封面相关参数，文案沿用当前内容 */
export const COVER_TEMPLATES: GalleryPreset[] = [
  {
    id: 'cover-classic-rose',
    name: '经典·居中',
    note: '纸感留白，标题居中',
    themeId: 'clean',
    colorId: 'rose',
    overrides: { coverOn: true, coverStyle: 'classic', cover: 'center', coverTitleSize: 88 },
    kind: 'cover',
  },
  {
    id: 'cover-editorial-tea',
    name: '左齐·茶褐',
    note: '暖棕左对齐，像杂志内页',
    themeId: 'clean',
    colorId: 'chase',
    overrides: {
      coverOn: true,
      coverStyle: 'editorial',
      coverTitleSize: 84,
      coverPadding: { top: 120, right: 96, bottom: 110, left: 96 },
    },
    kind: 'cover',
  },
  {
    id: 'cover-vertical-zhusha',
    name: '竖排·朱砂',
    note: '直排标题，右起阅读',
    themeId: 'clean',
    colorId: 'zhusha',
    overrides: { coverOn: true, coverStyle: 'vertical', coverTitleSize: 92 },
    kind: 'cover',
  },
  {
    id: 'cover-jacket-indigo',
    name: '书封·黛蓝',
    note: '内框书名，冷静克制',
    themeId: 'clean',
    colorId: 'dailan',
    overrides: { coverOn: true, coverStyle: 'jacket', coverTitleSize: 78 },
    kind: 'cover',
  },
  {
    id: 'cover-big-zhusha',
    name: '巨字·朱砂',
    note: '大字压满，适合观点',
    themeId: 'clean',
    colorId: 'zhusha',
    overrides: { coverOn: true, coverStyle: 'big', coverTitleSize: 120 },
    kind: 'cover',
  },
  {
    id: 'cover-index-bamboo',
    name: '索引·竹青',
    note: '目录式封面，信息型内容',
    themeId: 'clean',
    colorId: 'zhuqing',
    overrides: { coverOn: true, coverStyle: 'index', coverTitleSize: 72 },
    kind: 'cover',
  },
]

/** 把古典色合入 overrides（palette 是完整色板，不是主题名） */
export function resolvePreset(preset: GalleryPreset): XhsStyleOverrides {
  const color = preset.colorId ? CLASSICAL_COLORS.find((c) => c.id === preset.colorId) : undefined
  return color ? { ...preset.overrides, palette: paletteOf(color) } : preset.overrides
}
