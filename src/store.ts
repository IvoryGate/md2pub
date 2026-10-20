import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { deepMerge, type XhsStyleOverrides } from './platforms/xhs'
import { SAMPLE_COVER, SAMPLE_DOC } from './content/docs'

export interface CoverText {
  title: string
  subtitle: string
  author: string
  tags: string
  /** 图封面：图片地址（上传会转 data URL） */
  image?: string
  imageLayout?: 'overlay' | 'separate'
  /** 叠图遮罩强度 0–90 */
  imageScrim?: number
}

export interface CustomPreset {
  id: string
  name: string
  themeId: string
  overrides: XhsStyleOverrides
  coverText: CoverText
}


let lastPatchKey = ''
let lastPatchAt = 0

export const useStore = create<{
  markdown: string
  setMarkdown: (s: string) => void
  themeId: string
  setThemeId: (id: string) => void
  /** 应用画廊预设：整体替换主题与覆盖（不是深合并） */
  applyStylePreset: (themeId: string, overrides: XhsStyleOverrides) => void
  size: '3:4' | '1:1' | '4:5'
  setSize: (s: '3:4' | '1:1' | '4:5') => void
  /** 封面文字（与正文解耦；面板「封面」区编辑） */
  coverText: CoverText
  setCoverText: (p: Partial<CoverText>) => void
  /** 用户保存的样式预设（主题 + 覆盖 + 封面文字快照） */
  customPresets: CustomPreset[]
  savePreset: (name: string) => void
  deletePreset: (id: string) => void
  applyPreset: (id: string) => void
  watermark: string
  setWatermark: (s: string) => void
  /** 编辑器模式：source = 纯源码；edit = 实时预览；read = 阅读视图 */
  editorMode: 'source' | 'edit' | 'read'
  setEditorMode: (m: 'source' | 'edit' | 'read') => void
  /** UI 面板的版式参数微调（深合并叠加在所选主题之上） */
  overrides: XhsStyleOverrides
  patchLayout: (p: XhsStyleOverrides) => void
  resetOverrides: () => void
  /** 样式历史（撤销/重做；拖拽会按补丁键+时间合并） */
  past: XhsStyleOverrides[]
  future: XhsStyleOverrides[]
  undoLayout: () => void
  redoLayout: () => void
  /** 预览缩放（0.42~0.84） */
  previewScale: number
  setPreviewScale: (v: number) => void
  /** 导出设置 */
  exportScale: 1 | 2 | 3
  setExportScale: (v: 1 | 2 | 3) => void
  exportFormat: 'png' | 'jpg'
  setExportFormat: (v: 'png' | 'jpg') => void
  /** 预览参考线（边距/页眉页脚/内容框） */
  showGuides: boolean
  setShowGuides: (v: boolean) => void
  /** 右侧面板悬停时的检查目标（padding/header/footer/cover/...） */
  inspect: string | null
  setInspect: (v: string | null) => void
  /** 自定义 CSS（全局注入，谨慎使用） */
  customCss: string
  setCustomCss: (v: string) => void
}>()(
  persist(
    (set) => ({
      markdown: SAMPLE_DOC,
      setMarkdown: (markdown) => set({ markdown }),
      themeId: 'clean',
      setThemeId: (themeId) => set({ themeId }),
      applyStylePreset: (themeId, overrides) =>
        set((s) => ({
          themeId,
          overrides: JSON.parse(JSON.stringify(overrides)),
          past: [...s.past.slice(-49), s.overrides],
          future: [],
        })),
      size: '3:4',
      setSize: (size) => set({ size }),
      coverText: { ...SAMPLE_COVER },
      setCoverText: (p) => set((s) => ({ coverText: { ...s.coverText, ...p } })),
      customPresets: [],
      savePreset: (name) =>
        set((s) => ({
          customPresets: [
            ...s.customPresets,
            {
              id: `p${Date.now().toString(36)}`,
              name: name.trim() || `我的样式 ${s.customPresets.length + 1}`,
              themeId: s.themeId,
              overrides: JSON.parse(JSON.stringify(s.overrides)),
              coverText: { ...s.coverText },
            },
          ],
        })),
      deletePreset: (id) => set((s) => ({ customPresets: s.customPresets.filter((p) => p.id !== id) })),
      applyPreset: (id) =>
        set((s) => {
          const p = s.customPresets.find((x) => x.id === id)
          if (!p) return {}
          return {
            themeId: p.themeId,
            overrides: JSON.parse(JSON.stringify(p.overrides)),
            coverText: { ...p.coverText },
            past: [...s.past.slice(-49), s.overrides],
            future: [],
          }
        }),
      watermark: '@IvoryGate/md2pub',
      setWatermark: (watermark) => set({ watermark }),
      editorMode: 'edit',
      setEditorMode: (editorMode) => set({ editorMode }),
      overrides: {},
      past: [],
      future: [],
      patchLayout: (patch) =>
        set((s) => {
          const now = Date.now()
          const key = JSON.stringify(patch)
          // 同一个补丁在 700ms 内连续拖拽 → 合并为一步历史
          const coalesce = key === lastPatchKey && now - lastPatchAt < 700
          lastPatchKey = key
          lastPatchAt = now
          return {
            overrides: deepMerge(s.overrides, patch),
            past: coalesce ? s.past : [...s.past.slice(-49), s.overrides],
            future: [],
          }
        }),
      resetOverrides: () =>
        set((s) => ({ overrides: {}, past: [...s.past.slice(-49), s.overrides], future: [] })),
      undoLayout: () =>
        set((s) => {
          if (!s.past.length) return {}
          const prev = s.past[s.past.length - 1]!
          return { overrides: prev, past: s.past.slice(0, -1), future: [s.overrides, ...s.future].slice(0, 50) }
        }),
      redoLayout: () =>
        set((s) => {
          if (!s.future.length) return {}
          const next = s.future[0]!
          return { overrides: next, past: [...s.past.slice(-49), s.overrides], future: s.future.slice(1) }
        }),
      previewScale: 0.42,
      setPreviewScale: (previewScale) => set({ previewScale }),
      exportScale: 2,
      setExportScale: (exportScale) => set({ exportScale }),
      exportFormat: 'png',
      setExportFormat: (exportFormat) => set({ exportFormat }),
      showGuides: false,
      setShowGuides: (showGuides) => set({ showGuides }),
      inspect: null,
      setInspect: (inspect) => set({ inspect }),
      customCss: '',
      setCustomCss: (customCss) => set({ customCss }),
    }),
    {
      name: 'md2pub-store',
      version: 4,
      // v0 的 overrides = { padding, typography }；迁移到 layout v2 深合并形状
      migrate: (persisted: any, version: number) => {
        // 只对 v0 的旧形状做转换；v1 已经是新形状，不能再次重建（否则会丢掉 coverStyle / palette 等键）
        if (version < 1) {
          const o = persisted?.overrides
          if (o && (o.padding || o.typography)) {
            const t = o.typography ?? {}
            const next: Record<string, unknown> = {
              ...o,
              ...(o.padding ? { padding: o.padding } : {}),
              body: {
                ...(o.body ?? {}),
                ...(t.bodySize != null ? { size: t.bodySize } : {}),
                ...(t.lineRatio != null ? { lineRatio: t.lineRatio } : {}),
                ...(t.letterSpacing != null ? { letterSpacing: t.letterSpacing } : {}),
                ...(t.paragraphSpacing != null ? { paragraphSpacing: t.paragraphSpacing } : {}),
              },
            }
            if (t.headingSpaceBefore != null || t.headingSpaceAfter != null) {
              next.headings = {
                ...(o.headings ?? {}),
                h2: {
                  ...((o.headings ?? {}).h2 ?? {}),
                  ...(t.headingSpaceBefore != null ? { spaceBefore: t.headingSpaceBefore } : {}),
                  ...(t.headingSpaceAfter != null ? { spaceAfter: t.headingSpaceAfter } : {}),
                },
              }
            }
            persisted.overrides = next
          }
        }
        // v3：'image' 不再是独立版式，图片改为所有封面的图层
        // v4：移除发布文案/页数缓存（旧存档残留字段直接清掉）
        if (version < 3 && persisted?.overrides?.coverStyle === 'image') {
          persisted.overrides.coverStyle = 'classic'
        }
        if (persisted && (persisted.publish !== undefined || persisted.pageCount !== undefined)) {
          delete persisted.publish
          delete persisted.pageCount
        }
        return persisted
      },
    },
  ),
)

/** 全量独立的持久化键名（诊断用） */
export const STORE_KEY = 'md2pub-store'
