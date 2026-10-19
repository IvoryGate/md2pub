import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { deepMerge, type XhsStyleOverrides } from './platforms/xhs'

const DEFAULT_MD = `# 从展示到安装：买量的几个基础指标

买量这个过程是这样的：你花钱投了广告。用户在刷手机时，看到你的广告，被吸引住了，顺手点了一下。页面随即跳到应用商店。这时 ta 仍对你的这个产品感兴趣，于是点了下载，马上就打开，或者等会儿再打开。

## 核心公式

把上面的指标凑在一起，很容易就能得到下面这个公式：

$$
CPI = \\frac{CPM}{1000 \\times CTR \\times CVR} = \\frac{CPM}{IPM}
$$

有了这个公式，面对"买量为什么贵了/便宜了"这样的问题：

- CPM 涨了，CTR/CVR 没动 → 大盘问题
- CPM 没动，CTR 跌了 → 素材问题
- CPM、CTR 没动，CVR 跌了 → 产品侧问题
`

export const useStore = create<{
  markdown: string
  setMarkdown: (s: string) => void
  themeId: string
  setThemeId: (id: string) => void
  size: '3:4' | '1:1' | '4:5'
  setSize: (s: '3:4' | '1:1' | '4:5') => void
  /** 封面文字（与正文解耦：留空则回退到文档元数据；面板「封面」区编辑） */
  coverText: { title: string; subtitle: string; author: string; tags: string }
  setCoverText: (p: Partial<{ title: string; subtitle: string; author: string; tags: string }>) => void
  watermark: string
  setWatermark: (s: string) => void
  /** 编辑器模式：source = 纯源码；edit = 实时预览；read = 阅读视图 */
  editorMode: 'source' | 'edit' | 'read'
  setEditorMode: (m: 'source' | 'edit' | 'read') => void
  /** UI 面板的版式参数微调（深合并叠加在所选主题之上） */
  overrides: XhsStyleOverrides
  patchLayout: (p: XhsStyleOverrides) => void
  resetOverrides: () => void
}>()(
  persist(
    (set) => ({
      markdown: DEFAULT_MD,
      setMarkdown: (markdown) => set({ markdown }),
      themeId: 'clean',
      setThemeId: (themeId) => set({ themeId }),
      size: '3:4',
      setSize: (size) => set({ size }),
      coverText: { title: '', subtitle: '', author: '', tags: '' },
      setCoverText: (p) => set((s) => ({ coverText: { ...s.coverText, ...p } })),
      watermark: '@md2pub',
      setWatermark: (watermark) => set({ watermark }),
      editorMode: 'edit',
      setEditorMode: (editorMode) => set({ editorMode }),
      overrides: {},
      patchLayout: (patch) =>
        set((s) => ({ overrides: deepMerge(s.overrides, patch) })),
      resetOverrides: () => set({ overrides: {} }),
    }),
    {
      name: 'md2pub-store',
      version: 1,
      // v0 的 overrides = { padding, typography }；迁移到 layout v2 深合并形状
      migrate: (persisted: any) => {
        const o = persisted?.overrides
        if (o && (o.padding || o.typography)) {
          const t = o.typography ?? {}
          persisted.overrides = {
            ...(o.padding ? { padding: o.padding } : {}),
            body: {
              ...(t.bodySize != null ? { size: t.bodySize } : {}),
              ...(t.lineRatio != null ? { lineRatio: t.lineRatio } : {}),
              ...(t.letterSpacing != null ? { letterSpacing: t.letterSpacing } : {}),
              ...(t.paragraphSpacing != null ? { paragraphSpacing: t.paragraphSpacing } : {}),
            },
            ...(t.headingSpaceBefore != null
              ? { headings: { h2: { spaceBefore: t.headingSpaceBefore } } }
              : {}),
            ...(t.headingSpaceAfter != null
              ? { headings: { ...persisted.overrides?.headings, h2: { spaceAfter: t.headingSpaceAfter } } }
              : {}),
          }
        }
        return persisted
      },
    },
  ),
)

/** 全量独立的持久化键名（诊断用） */
export const STORE_KEY = 'md2pub-store'
