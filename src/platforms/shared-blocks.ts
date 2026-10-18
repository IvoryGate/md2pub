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
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' })
    mermaidReady = true
  }
  return mermaid
}

export function useDiagramSvg(kind: 'mermaid' | 'plantuml', text: string) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    setError('')
    setSvg('')
    if (kind === 'mermaid') {
      ensureMermaid()
        .then(m => m.render(`mmd-${Math.random().toString(36).slice(2)}`, text))
        .then(({ svg }) => {
          if (alive) setSvg(svg)
        })
        .catch(err => {
          if (alive) setError(String(err?.message ?? err))
        })
    } else {
      // PlantUML：走公共渲染服务 Kroki（网络依赖，MVP 够用）
      fetch('https://kroki.io/plantuml/svg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagram_source: text, diagram_type: 'plantuml' }),
      })
        .then(r => r.text())
        .then(body => {
          if (!alive) return
          if (body.startsWith('<svg') || body.includes('<svg')) setSvg(body)
          else setError(body.slice(0, 200))
        })
        .catch(err => alive && setError(String(err)))
    }
    return () => {
      alive = false
    }
  }, [kind, text])
  return { svg, error }
}
