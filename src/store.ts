import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { XhsPadding, XhsTypography, XhsStyleOverrides } from './platforms/xhs'

const DEFAULT_MD = `# 3 个被低估的 Notion 数据技巧

一句话介绍：这 3 个技巧让你用 Notion 数据库的效率翻倍，最后一个 90% 的人都不知道！

## 1. 分组视图 + 折叠规则

数据库分组其实可以按「是否完成」自动排序，**未完成永远在最上面**。

## 2. 用公式字段做智能标签

- 根据截止日期自动显示「过期 / 今天 / 剩余 3 天」
- 颜色跟着状态变化
- 不需要手动打标签

## 3. 关联数据库做周复盘

> 每周五花 10 分钟，把本周任务数据库和周记数据库关联起来。

数学公式也能排：

$$
\\int_{0}^{\\infty} e^{-x^2} \\, dx = \\frac{\\sqrt{\\pi}}{2}
$$

---

*觉得有用的话，点赞收藏，下期分享 Notion + 日历的神仙组合！*
`

const EMPTY_OVERRIDES: XhsStyleOverrides = { padding: {}, typography: {} }

interface XhsOverrides extends XhsStyleOverrides {}

export const useStore = create<{
  markdown: string
  setMarkdown: (s: string) => void
  themeId: string
  setThemeId: (id: string) => void
  size: '3:4' | '1:1' | '4:5'
  setSize: (s: '3:4' | '1:1' | '4:5') => void
  watermark: string
  setWatermark: (s: string) => void
  /** 编辑器模式：源码 = 纯源码；edit = 实时预览（行内半渲染）；read = 阅读视图 */
  editorMode: 'source' | 'edit' | 'read'
  setEditorMode: (m: 'source' | 'edit' | 'read') => void
  /** UI 面板的排版参数微调（叠加在所选主题之上） */
  overrides: XhsOverrides
  patchPadding: (p: Partial<XhsPadding>) => void
  patchTypography: (t: Partial<XhsTypography>) => void
  resetOverrides: () => void
}>()(
  persist(
    (set) => ({
      markdown: DEFAULT_MD,
      setMarkdown: (markdown) => set({ markdown }),
      themeId: 'clean',
      setThemeId: (themeId) => set({ themeId, overrides: EMPTY_OVERRIDES }),
      size: '3:4',
      setSize: (size) => set({ size }),
      watermark: '@md2pub',
      setWatermark: (watermark) => set({ watermark }),
      editorMode: 'edit',
      setEditorMode: (editorMode) => set({ editorMode }),
      overrides: EMPTY_OVERRIDES,
      patchPadding: (padding) =>
        set((s) => ({ overrides: { ...s.overrides, padding: { ...s.overrides.padding, ...padding } } })),
      patchTypography: (typography) =>
        set((s) => ({ overrides: { ...s.overrides, typography: { ...s.overrides.typography, ...typography } } })),
      resetOverrides: () => set({ overrides: EMPTY_OVERRIDES }),
    }),
    { name: 'md2pub-store' },
  ),
)

/** 全量独立的持久化键名（诊断用） */
export const STORE_KEY = 'md2pub-store'
