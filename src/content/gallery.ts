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

/** 风格预设：改版式与配色，不动正文内容 */
export const STYLE_PRESETS: GalleryPreset[] = [
  {
    id: 'clean-paper',
    name: '清爽纸白',
    note: '默认的米白纸 + 玫红强调',
    themeId: 'clean',
    overrides: {},
    kind: 'style',
  },
  {
    id: 'magazine-warm',
    name: '文艺杂志',
    note: '宋体、通栏图、左侧重标题',
    themeId: 'magazine',
    overrides: {},
    kind: 'style',
  },
  {
    id: 'dark-night',
    name: '暗夜',
    note: '深色底 + 荧光青强调',
    themeId: 'dark',
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
    id: 'tea-editorial',
    name: '茶褐杂志',
    note: '暖棕纸 + 杂志式标题',
    themeId: 'magazine',
    colorId: 'chase',
    overrides: {},
    kind: 'style',
  },
  {
    id: 'songhua-index',
    name: '松花索引',
    note: '浅绿纸 + 索引式章节',
    themeId: 'clean',
    colorId: 'songhua',
    overrides: { headings: { h2: { decoration: 'dots' } } },
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
    name: '杂志·左齐',
    note: '暖棕杂志，标题左对齐',
    themeId: 'magazine',
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
    id: 'cover-big-night',
    name: '巨字·暗夜',
    note: '大字压满，适合观点',
    themeId: 'dark',
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
