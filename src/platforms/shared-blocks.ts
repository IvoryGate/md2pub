import { useEffect, useState } from 'react'
import katex from 'katex'

/**
 * 平台共享的异步内容渲染原子（小红书卡片与编辑器阅读视图共用）：
 * - renderMathHtml：KaTeX display HTML
 * - useDiagramSvg：Mermaid / PlantUML → svg（含错误捕获）
 * 组件只负责数据；视觉由调用方决定。
 */

export const renderMathHtml = (text: string, errorColor?: string): string => {
  try {
    return katex.renderToString(text, { displayMode: true, throwOnError: false })
  } catch {
    return `<code style="color:${errorColor ?? '#c0564e'}">KaTeX 渲染失败：${text}</code>`
  }
}

let mermaidReady = false
const ensureMermaid = async () => {
  const mermaid = (await import('mermaid')).default
  if (!mermaidReady) {
    mermaid.initialize({ startOnLoad: false, theme: 'base', securityLevel: 'loose' })
    mermaidReady = true
  }
  return mermaid
}

export interface DiagramOpts {
  /** mermaid themeVariables（配合 theme:'base'；由调用方从主题色板派生，与卡片同调） */
  mermaidVars?: Record<string, string>
}

/** 图表 svg 拉满内容宽：仅对根 <svg> 标签删自带 max-width / 固定宽高，
    靠 viewBox 等比撑满容器；内层元素（节点矩形的 width/height 等属性定位）
    一个都不能动——全局清洗会把节点尺寸清零，只剩连线 */
const fitFullWidth = (svg: string): string => {
  const root = svg.match(/<svg[^>]*>/)?.[0]
  if (!root) return svg
  const patched =
    root
      .replace(/\s(width|height)="[^"]*"/g, '')
      .replace(/\sstyle="[^"]*"/g, '')
      .replace(/<svg\b/, '<svg style="width:100%;height:auto;display:block" ')
  return svg.replace(root, patched)
}

/** Mermaid / PlantUML → svg（失败 reject 错误信息） */
export async function diagramSvg(kind: 'mermaid' | 'plantuml', text: string, opts?: DiagramOpts): Promise<string> {
  if (kind === 'mermaid') {
    const m = await ensureMermaid()
    if (opts?.mermaidVars)
      m.initialize({ startOnLoad: false, theme: 'base', securityLevel: 'loose', themeVariables: opts.mermaidVars })
    const { svg } = await m.render(`mmd-${Math.random().toString(36).slice(2)}`, text)
    return fitFullWidth(svg)
  }
  // PlantUML：走公共渲染服务 Kroki（网络依赖，MVP 够用）
  const body = await fetch('https://kroki.io/plantuml/svg', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ diagram_source: text, diagram_type: 'plantuml' }),
  }).then(r => r.text())
  if (!body.includes('<svg')) throw new Error(body.slice(0, 300))
  return fitFullWidth(body.slice(body.indexOf('<svg')))
}

export function useDiagramSvg(kind: 'mermaid' | 'plantuml', text: string, opts?: DiagramOpts) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const optsKey = JSON.stringify(opts)
  useEffect(() => {
    let alive = true
    setError('')
    setSvg('')
    diagramSvg(kind, text, JSON.parse(optsKey))
      .then(svg => {
        if (alive) setSvg(svg)
      })
      .catch(err => {
        if (alive) setError(String(err?.message ?? err))
      })
    return () => {
      alive = false
    }
  }, [kind, text, optsKey])
  return { svg, error }
}
