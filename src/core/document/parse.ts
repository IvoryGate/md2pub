import MarkdownIt from 'markdown-it'
import katexPlugin from '@vscode/markdown-it-katex'
import type Token from 'markdown-it/lib/token.mjs'
import type { Block, DocMeta, Document } from './types'

/**
 * core 解析器：基于 markdown-it 的 token 级解析。
 * - front-matter 仅支持文档开头 `--- title/tags/author/cover` 围栏；
 * - `---` 在正文中保持原生语义（hr → divider）；
 * - 显式分页：`<!-- pagebreak -->` 或 `<!-- newpage -->`（HTML 注释对渲染无污染）；
 * - 数学：$...$ / $$...$$ → math / 行内由 KaTeX 渲染；
 * - 图表：```mermaid / ```plantuml 围栏 → 对应块类型。
 */

export const md = MarkdownIt({ html: false, breaks: true, linkify: true })
md.use(katexPlugin)

const PAGEBREAK_RE = /<!--\s*(?:pagebreak|newpage)\s*-->/i

/** 仅供 UI 在纯文本上下文（标题/标签/列表符号）使用 */
export const stripInline = (text: string): string =>
  text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '')
    .replace(/\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/[*_`~]{1,3}([^*_`~]+)[*_`~]{1,3}/g, '$1')
    .replace(/\$\$([^$]+)\$\$/g, '$1')
    .replace(/\$([^$]+)\$/g, '$1')
    .trim()

/** 行内渲染器：markdown + KaTeX 行内公式（平台渲染器共享入口） */
export function renderInline(text: string): string {
  try {
    return md.renderInline(text)
  } catch {
    return text
  }
}

function parseFrontMatter(raw: string): { meta: DocMeta; body: string } {
  const meta: DocMeta = { tags: [] }
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(raw.trimStart())
  if (!match) return { meta, body: raw }

  for (let i = 0; i < match[1]!.split('\n').length; i++) {
    const line = match[1].split('\n')[i]!
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (key === 'title') meta.title = value || undefined
    else if (key === 'author') meta.author = value
    else if (key === 'cover') meta.cover = value
    else if (key === 'tags') {
      // 两种写法：逗号分隔 `tags: a, b` 或 YAML 列表
      if (value) {
        meta.tags = value.split(/[,，]/).map(t => t.trim()).filter(Boolean)
      } else {
        // 收集后续 `- item` 行
        const items: string[] = []
        for (let j = i + 1; j < match[1].split('\n').length; j++) {
          const l = match[1].split('\n')[j]!
          const m = /^\s*-\s+(.+)$/.exec(l)
          if (!m) break
          items.push(m[1].trim())
        }
        meta.tags = items
      }
    }
  }
  return { meta, body: raw.slice(match[0].length) }
}

// ---------- token → Block 状态机 ----------

interface ScanState {
  blocks: Block[]
}

function scanTokens(tokens: Token[]): Block[] {
  const { blocks } = (() => {
    const state: ScanState = { blocks: [] }
    let i = 0

    const push = (b: Block) => state.blocks.push(b)

    while (i < tokens.length) {
      const t = tokens[i]!
      // 记录源码起始行，供编辑器 ↔ 卡片轨道的位置级滚动联动使用
      const pushAt = (b: Block) => state.blocks.push({ line: t.map?.[0], ...b })

      switch (t.type) {
        // 标题: heading_open, inline, heading_close
        case 'heading_open': {
          const inline = tokens[i + 1]
          const level = parseInt(t.tag!.slice(1), 10) as 1 | 2 | 3 | 4
          pushAt({ type: 'heading', level, text: stripInline(inline?.content ?? '') })
          i += 3
          continue
        }

        // 段落: paragraph_open, inline, paragraph_close
        case 'paragraph_open': {
          const inline = tokens[i + 1]
          // 段落若只包含一张图片（独立图片行），识别为 image 块
          const imageChild = inline?.children?.find(c => c.type === 'image')
          if (inline?.children && inline.children.filter(c => c.type !== 'text' && c.type !== 'softbreak').length === 1 && imageChild) {
            pushAt({ type: 'image', url: imageChild.attrGet('src') ?? '', alt: stripInline(imageChild.content || '') || undefined })
          } else if (PAGEBREAK_RE.test((inline?.content ?? '').trim())) {
            // html:false 时，独立成行的 HTML 注释会落在段落里——还原为显式分页
            pushAt({ type: 'pagebreak' })
          } else {
            pushAt({ type: 'paragraph', text: inline?.content ?? '' })
          }
          i += 3
          continue
        }

        // 围栏代码 / mermaid / plantuml
        case 'fence': {
          const info = (t.info ?? '').trim()
          if (info === 'mermaid') pushAt({ type: 'mermaid', text: t.content ?? '' })
          else if (info === 'plantuml') push({ type: 'plantuml', text: t.content ?? '' })
          else push({ type: 'code', lang: info || undefined, text: t.content ?? '' })
          i++
          continue
        }

        // 块级公式
        case 'math_block': {
          pushAt({ type: 'math', text: t.content ?? '' })
          i++
          continue
        }

        // 表格（GFM）：table_open 后按 thead/tbody/tr/th/td 结构收集
        case 'table_open': {
          const head: string[] = []
          const rows: string[][] = []
          let row: string[] = []
          let isHead = true
          i++
          while (i < tokens.length) {
            const tk = tokens[i]!
            if (tk.type === 'table_close') {
              i++
              break
            }
            switch (tk.type) {
              case 'thead_close':
                isHead = false
                break
              case 'tr_open':
                row = []
                break
              case 'inline':
                row.push(tk.content)
                break
              case 'tr_close':
                if (isHead) head.push(...row)
                else rows.push(row)
                break
            }
            i++
          }
          pushAt({ type: 'table', head, rows })
          continue
        }

        // 引用（含嵌套）：收集期间出现的所有 inline 文本行
        case 'blockquote_open': {
          let depth = 0
          const parts: string[] = []
          while (i < tokens.length) {
            const tk = tokens[i]!
            if (tk.type === 'blockquote_open') depth++
            if (tk.type === 'blockquote_close') {
              depth--
              if (depth === 0) {
                i++
                break
              }
            }
            if (tk.type === 'inline') parts.push(tk.content)
            i++
          }
          pushAt({ type: 'quote', text: parts.join('\n') })
          continue
        }

        // 列表（含嵌套子列表）：收集每个 list_item 内的 inline 内容
        case 'bullet_list_open':
        case 'ordered_list_open': {
          const ordered = t.type === 'ordered_list_open'
          const items: string[] = []
          let itemParts: string[] = []
          while (i < tokens.length) {
            const tk = tokens[i]!
            if (tk.type === 'list_item_open') itemParts = []
            else if (tk.type === 'list_item_close') items.push(itemParts.join(' '))
            else if (tk.type === 'inline') itemParts.push(tk.content)
            else if (tk.type === 'bullet_list_close' || tk.type === 'ordered_list_close') {
              // 内层列表先闭合——用深度栈处理
              break
            }
            i++
          }
          pushAt({ type: 'list', ordered, items: items.filter(s => s.trim() !== '') })
          continue
        }

        // 图片 token（如由 front-matter/特殊场景产生）
        case 'image': {
          pushAt({ type: 'image', url: t.attrGet('src') ?? '', alt: stripInline(t.content || '') || undefined })
          i++
          continue
        }

        // hr（thematic break，如 `---`）
        case 'hr': {
          pushAt({ type: 'divider' })
          i++
          continue
        }

        // 显式分页注释
        case 'html_block': {
          if (PAGEBREAK_RE.test(t.content)) pushAt({ type: 'pagebreak' })
          i++
          continue
        }

        // inline token 在 paragraph/list/blockquote 内部均被上层消费
        default:
          i++
          continue
      }
    }
    return state
  })()

  return blocks
}

export function parseDocument(raw: string): Document {
  const { meta, body } = parseFrontMatter(raw)
  const blocks = scanTokens(md.parse(body, {}))

  // 无显式标题时，取第一个 h1/h2 作为标题（供封面使用）
  if (!meta.title) {
    const firstHeading = blocks.find(b => b.type === 'heading' && b.level <= 2)
    if (firstHeading && firstHeading.type === 'heading') meta.title = firstHeading.text
  }
  return { meta, blocks }
}
