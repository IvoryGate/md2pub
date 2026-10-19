/**
 * 小红书主题模型 v2。
 * 核心：卡片样式由「版式参数」驱动（类比 LaTeX / Word），面板里没有散装魔法数字。
 * 主题 = 纯数据（JSON 序列化，可导入导出/分享），所有平台渲染器与测高分页共享同一组值。
 *
 * 版式调研依据（2026-10 联网调研）：
 * - xhs-article-images-skill 长文图设计规范：正文 17px/行高 1.75、标题上 28 下 14、
 *   引用/结论卡竖条+浅底、图片通栏+细描边、标题不得孤行页尾
 * - vivy-yi/xiaohongshu-skills graphic-layout：层级靠字号对比（重要元素 2~3×）、
 *   页边留白 5~10% 宽、行距 1.4~1.6×、正文 ≥20pt（1080 宽折算 ≥36px）
 * - 卡片模板五件套：尺寸 / 三色系 / 三级字号 / 版式骨架 / 页眉页脚固定位置
 */

export const XHS_CARD_SIZES = {
  '3:4': { width: 1080, height: 1440 },
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

export type HeadingDecoration = 'none' | 'bar' | 'bar-right' | 'underline' | 'twin' | 'dots' | 'pill' | 'flank'

/** 页眉/页脚元素锚点（六向） */
export type ChromePos = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
/** 兼容旧存档的 left/center/right（等价于底部三向） */
export const normalizeChromePos = (p: string): ChromePos =>
  p === 'left' ? 'bottom-left' : p === 'center' ? 'bottom-center' : p === 'right' ? 'bottom-right' : (p as ChromePos)
export type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4'

/** 分级标题样式（首个 h1 归封面；正文中的 h1 视为章节开头档，h5/h6 合并进 h4 的比例档） */
export interface XhsHeadingStyle {
  /** 相对正文字号的比例（预设定义用） */
  sizeRatio: number
  /** 绝对字号 px；设置后不再随正文缩放 */
  size?: number
  /** 字重 400~800 */
  weight: number
  align: 'left' | 'center' | 'right'
  /** 段前/段后 px */
  spaceBefore: number
  spaceAfter: number
  decoration: HeadingDecoration
  /** 字距 px（缺省跟随正文） */
  tracking?: number
  /** 行高比（缺省 = 正文行距 × 0.82；设置后独立） */
  lineHeight?: number
}

/** 完整版式卡：页面骨架 + 各元素元素的布局参数（不含颜色） */
export interface XhsLayout {
  padding: XhsPadding
  /** 正文段落 */
  body: {
    /** 正文字号 px（1080 宽卡片推荐 36~44） */
    size: number
    /** 行高 / 字号 比 */
    lineRatio: number
    /** 字间距 px */
    letterSpacing: number
    /** 段间距 px（块间统一 gap，分页装箱同源） */
    paragraphSpacing: number
    align: 'left' | 'justify'
  }
  headings: Record<HeadingLevel, XhsHeadingStyle>
  /** 列表 */
  list: {
    /** 挂起缩进 px（序号/圆点之后正文起点；折行对齐） */
    indent: number
    /** 条目间距 px */
    itemGap: number
  }
  quote: { pad: number; radius: number }
  /** 图表类块（引用/代码/表格/mermaid/PlantUML）与上下文的独立呼吸位：
      卡片是成品图，浮体元素需要比段落更宽的前后间隔，不能混用统一 gap */
  blocks: { /** 前后留白 px（与内容区 flex gap 叠加生效） */ marginY: number }
  code: {
    /** 代码字号 = 正文 × 比例 */
    sizeRatio: number
    pad: number
    radius: number
    /** 语言标签（头带）开关 */
    showLang: boolean
  }
  table: { sizeRatio: number; cellPad: number }
  image: {
    /** 通栏（贴出页边距）还是对齐内容区 */
    fullBleed: boolean
    radius: number
    /** 细描边（palette.muted 淡化） */
    outline: boolean
    /** 上下留白 px */
    marginY: number
  }
  divider: { /** 上下留白 px */ gapY: number }
  header: {
    showTag: boolean
    showPageNum: boolean
    /** 页码锚点（默认右下） */
    pageNumPos: ChromePos
    height: number
  }
  watermark: {
    enabled: boolean
    pos: ChromePos
    /** 封面水印：独立开关 + 独立位置 */
    cover: boolean
    coverPos: ChromePos
  }
  /** 封面：显式开关（不再由首个 h1 隐式决定）。
      关闭时首个 h1 留在正文，作为章节开头档（居中胶囊条 h1 档） */
  coverOn: boolean
  /** 封面样式：classic 经典 / editorial 杂志 / poster 海报 / jacket 书封 / index 索引 */
  coverStyle: 'classic' | 'vertical' | 'big' | 'editorial' | 'jacket' | 'index'
  /** 经典封面版式位置 */
  cover: 'top' | 'center' | 'bottom'
  /** 封面标题绝对字号 px（设置后不随正文缩放） */
  coverTitleSize?: number
  /** 分页策略：全局最优（DP）/ 顺序贪心 */
  pagination: 'optimal' | 'greedy'
  /** 纸面颗粒质感（极轻的网点，导出可见） */
  paperTexture: boolean
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
  /** 行内加粗（Phycat light-deep 玫红） */
  strong: string
  /** 行内斜体（Phycat secondary 紫） */
  italic: string
}

export interface XhsCardTheme {
  id: string
  name: string
  fontFamily: string
  layout: XhsLayout
  palette: XhsPalette
  /** 背景圆角（导出四角圆弧） */
  radius: number
  bulletSymbol: string
}

/** mermaid theme:'base' 的调色变量——全部从卡片色板/字体派生，图表与卡片同调 */
export const xhsMermaidVars = (theme: XhsCardTheme): Record<string, string> => {
  const p = theme.palette
  return {
    fontFamily: theme.fontFamily,
    background: 'transparent',
    // 主节点：accent 淡染底 + accent 描边 + 正文色文字
    primaryColor: `${p.accent}24`,
    primaryTextColor: p.text,
    primaryBorderColor: p.accent,
    secondaryColor: p.quoteBg,
    tertiaryColor: `${p.accent}0d`,
    lineColor: p.text,
    // 决策线/标注文字与正文同明度，不抢戏
    edgeLabelBackground: p.bg,
    clusterBkg: `${p.accent}0d`,
    clusterBorder: `${p.accent}40`,
    noteBkgColor: p.quoteBg,
    noteBorderColor: `${p.accent}4d`,
    noteTextColor: p.text,
    titleColor: p.heading,
    // 时序图
    mainBkg: `${p.accent}18`,
    actorBorder: p.accent,
    actorTextColor: p.text,
    signalColor: p.text,
    signalTextColor: p.text,
    activationBkgColor: p.quoteBg,
    activationBorderColor: p.accent,
  }
}

/* 卡片正文首选霞鹜文楷（由 index.css 引入 @font-face，离线打包可用）；
   后备保持系统黑体族以防分片未就绪 */
const FONT_SANS = '"LXGW WenKai", PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif'
const FONT_SERIF = '"Source Han Serif SC", "Noto Serif SC", SimSun, serif'

/** 通用基准版式（按调研规范取中值；主题在此之上微调） */
const baseLayout: XhsLayout = {
  padding: { top: 112, right: 88, bottom: 124, left: 88 },
  body: {
    /** 正文字号 px（1080 宽卡片推荐 30~38） */
    size: 34,
    /** 行高 / 字号 比 */
    lineRatio: 1.7,
    /** 字间距 px */
    letterSpacing: 0.5,
    /** 段间距 px（块间统一 gap，分页装箱同源） */
    paragraphSpacing: 22,
    align: 'justify',
  },
  headings: {
    // 推导：调研规范（17px 正文）标题「上28/下14」 → ×(34/17) = 2.0 → 上56/下28；
    // 卡片内容区为 flex 列 + gap（paragraphSpacing=22），段前/段后与 gap 叠加生效，
    // 因此 spaceBefore/After = 目标视觉间距 − paragraphSpacing（保持纯数据、与内容无关）
    // h1 = 章节开头档（封面之后又出现的 h1）：Phycat h1 居中 + 底部渐变胶囊条。
    // 空间层级：段前 76（56+22 gap）、段后 38（16+22）——作为「章」必须比 h2 的
    // 56/28 明显更透气；h1 若落在页首，段前距由渲染层丢弃（页边距已提供顶部空气）
    h1: { sizeRatio: 1.55, weight: 700, align: 'center', spaceBefore: 54, spaceAfter: 16, decoration: 'pill' },
    // h2 = Phycat「双子塔」：主色长条 + 辅紫短条下移错位（×2.0 卡片尺度）
    h2: { sizeRatio: 1.5, weight: 700, align: 'left', spaceBefore: 34, spaceAfter: 6, decoration: 'twin', tracking: 0.5 },
    // h3 = Phycat h3：细竖条 + 尾部浅粉三点图标（SVG mask）
    h3: { sizeRatio: 1.15, weight: 700, align: 'left', spaceBefore: 26, spaceAfter: 6, decoration: 'dots', tracking: 0.5 },
    h4: { sizeRatio: 1.0, weight: 600, align: 'left', spaceBefore: 14, spaceAfter: 6, decoration: 'dots', tracking: 0.5 },
  },
  list: { indent: 34, itemGap: 12 },
  quote: { pad: 24, radius: 12 },
  blocks: { marginY: 16 },
  code: { sizeRatio: 0.62, pad: 25, radius: 16, showLang: true },
  table: { sizeRatio: 0.8, cellPad: 16 },
  image: { fullBleed: false, radius: 12, outline: true, marginY: 16 },
  divider: { gapY: 26 },
  header: { showTag: true, showPageNum: true, pageNumPos: 'bottom-right', height: 56 },
  watermark: { enabled: true, pos: 'bottom-left', cover: true, coverPos: 'bottom-left' },
  coverOn: true,
  coverStyle: 'classic',
  cover: 'center',
  pagination: 'optimal',
  paperTexture: false,
}

export const XHS_THEMES: XhsCardTheme[] = [
  {
    id: 'clean',
    name: '清爽版',
    fontFamily: FONT_SANS,
    layout: structuredClone(baseLayout),
    palette: {
      // 米白纸色：比纯白暖一点、远轻于杂志版（#f6f1e7）
      bg: '#fcf9f2',
      text: '#3a3a3a',
      heading: '#1f1f1f',
      accent: '#ff2e4d',
      // 次要文字：旧值 #9a9a94 在暖纸色上偏淡，封面副题/作者读不清
      muted: '#7f7f76',
      quoteBg: '#fdf2f4',
      codeBg: '#2f2f2f',
      codeFg: '#f5f2ea',
      strong: '#e91e63',
      italic: '#bd93f9',
    },
    radius: 24,
    bulletSymbol: '•',
  },
  {
    id: 'magazine',
    name: '文艺杂志版',
    fontFamily: FONT_SERIF,
    layout: {
      ...structuredClone(baseLayout),
      padding: { top: 104, right: 96, bottom: 104, left: 96 },
      body: { ...baseLayout.body, size: 36, lineRatio: 1.85, letterSpacing: 1.2, align: 'justify' },
      headings: {
        ...baseLayout.headings,
        h2: { ...baseLayout.headings.h2, weight: 800, spaceBefore: 56 },
      },
      list: { indent: 44, itemGap: 16 },
      quote: { pad: 26, radius: 4 },
      image: { fullBleed: true, radius: 8, outline: true, marginY: 18 },
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
      strong: '#a3512a',
      italic: '#a3779d',
    },
    radius: 8,
    bulletSymbol: '◦',
  },
  {
    id: 'dark',
    name: '暗夜版',
    fontFamily: FONT_SANS,
    layout: {
      ...structuredClone(baseLayout),
      headings: { ...baseLayout.headings, h2: { ...baseLayout.headings.h2, decoration: 'underline' } },
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
      strong: '#ff7096',
      italic: '#c9b8f5',
    },
    radius: 24,
    bulletSymbol: '▸',
  },
]

export const getTheme = (id: string): XhsCardTheme =>
  XHS_THEMES.find(t => t.id === id) ?? XHS_THEMES[0]!

/** ======================= 版式覆盖 ======================= */

/** 任意字段的弱类型局部覆盖（面板滑杆只提供 patch，递归合并到此展开） */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

/** 面板对主题的微调 = 对当前主题版式的深合并覆盖（保持纯数据） */
export type XhsStyleOverrides = DeepPartial<XhsLayout> & {
  /** 色板覆盖（角色级；留空则跟随主题预设） */
  palette?: Partial<XhsPalette>
}

/** 递归深合并（数组/原始值直接覆盖）。store patch 与主题合成共用 */
export function deepMerge<T>(target: T, patch?: DeepPartial<T>): T {
  if (!patch) return target
  const out: any = Array.isArray(target) ? [...(target as any)] : { ...(target as any) }
  for (const k of Object.keys(patch) as Array<keyof T>) {
    const pv = (patch as any)[k]
    const tv = (target as any)[k]
    out[k] =
      pv && typeof tv === 'object' && tv && !Array.isArray(tv) && typeof pv === 'object'
        ? deepMerge(tv, pv)
        : pv
  }
  return out
}

export function applyXhsOverrides(base: XhsCardTheme, overrides: XhsStyleOverrides): XhsCardTheme {
  const { palette, ...layoutOverrides } = (overrides ?? {}) as XhsStyleOverrides
  return {
    ...base,
    layout: deepMerge(base.layout, layoutOverrides as DeepPartial<XhsLayout>),
    palette: { ...base.palette, ...(palette ?? {}) },
  }
}


/**
 * 内容可用区派生：
 * - contentWidth：页宽 - 左右边距
 * - availableHeight：页高 - 上下边距 -（页眉可见时的页眉带）-（水印开启时的页脚带）
 *   页码是页眉带元素、水印叠加在底边距带内；两个带都与正文保持呼吸间距，正文永不贴到水印。
 */
export function computeContentMetrics(size: { width: number; height: number }, theme: XhsCardTheme) {
  const { padding, body, header } = theme.layout
  const contentWidth = size.width - padding.left - padding.right
  const headerVisible = header.showTag || header.showPageNum
  /* 版心 = 卡片高 − 上下边距。页眉/水印都**住在边距带内部**（随边距走），
     不再额外占正文高度——旧模型把 header.height 与 64px 水印带从版心扣掉，
     等于页眉贴正文、底部双重留白。 */
  const availableHeight = size.height - padding.top - padding.bottom
  return { contentWidth, availableHeight, body, headerVisible }
}
