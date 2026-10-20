import typesettingDesign from '../../docs/typesetting-design.md?raw'
import colorDesign from '../../docs/color-design.md?raw'
import typesettingAlgorithm from '../../docs/typesetting-algorithm.md?raw'
import sampleDocument from './sample-document.md?raw'

export interface DocEntry {
  slug: string
  title: string
  eyebrow: string
  summary: string
  body: string
  /** 示例文档：额外提供「载入编辑器」 */
  sample?: boolean
}

export const SAMPLE_DOC = sampleDocument

/** 示例文档配套封面（首次安装 / 一键载入时使用） */
export const SAMPLE_COVER = {
  title: '把复杂的事讲清楚',
  subtitle: '一份内容卡片的结构清单',
  author: 'IvoryGate',
  tags: '写作, 排版, 内容设计',
  image: '',
  imageLayout: 'overlay' as const,
  imageScrim: 55,
}

export const DOCS: DocEntry[] = [
  {
    slug: 'typesetting-design',
    title: '排版设计',
    eyebrow: '设计文档',
    summary: '为什么正文是 34px / 1.7，边距是 88px；卡片为什么需要一套自己的断行与节奏。',
    body: typesettingDesign,
  },
  {
    slug: 'color-design',
    title: '颜色设计',
    eyebrow: '设计文档',
    summary: '从 OKLCH 的角色分工，到对比度硬约束、纸色温度与古典色的取舍。',
    body: colorDesign,
  },
  {
    slug: 'typesetting-algorithm',
    title: '排版算法',
    eyebrow: '实现文档',
    summary: '测量、KP 断行、全篇动态规划分页，以及卡片拆分与滚动同步的实现。',
    body: typesettingAlgorithm,
  },
  {
    slug: 'sample',
    title: '示例文档',
    eyebrow: '范例',
    summary: '一份覆盖各级标题、表格、图片、公式、Mermaid 图表与代码块的完整文章。',
    body: sampleDocument,
    sample: true,
  },
]

export const docBySlug = (slug: string | null) => DOCS.find((d) => d.slug === slug)
