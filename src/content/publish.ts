import { parseDocument, stripInline } from '../core/document/parse'

export interface PublishDraft {
  title: string
  body: string
  tags: string
  mention: string
}

export interface PublishSource {
  title: string
  author: string
  tags: string
}

const clip = (s: string, max: number) => {
  const chars = [...s.trim()]
  if (chars.length <= max) return chars.join('')
  // 尽量在句末截断，避免半句话
  const slice = chars.slice(0, max).join('')
  const end = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('！'), slice.lastIndexOf('？'), slice.lastIndexOf('.'))
  if (end > max * 0.55) return slice.slice(0, end + 1)
  return `${slice.slice(0, max - 1)}…`
}

const tagLineOf = (tags: string) =>
  tags
    .split(/[,，\s]+/)
    .map((t) => t.replace(/^#+|#+$/g, '').trim())
    .filter(Boolean)
    .join(', ')

/**
 * 从正文与封面自动起一份小红书发布草稿：
 * - 标题优先封面标题，其次 front-matter / 首个 H1
 * - 正文 = 首段钩子 + H2 要点 + 行动句
 * - 话题优先封面标签，其次 front-matter，最后文末 hashtag
 * - @ 优先封面作者
 */
export function derivePublish(markdown: string, cover: PublishSource): PublishDraft {
  const doc = parseDocument(markdown)
  const headings = doc.blocks.filter((b) => b.type === 'heading') as Array<{ type: 'heading'; level: number; text: string }>
  const paragraphs = doc.blocks.filter((b) => b.type === 'paragraph') as Array<{ type: 'paragraph'; text: string }>

  const title = clip(stripInline(cover.title || doc.meta.title || headings.find((h) => h.level === 1)?.text || ''), 20)

  const leadBlock = paragraphs.find((p) => stripInline(p.text).trim().length >= 20) ?? paragraphs[0]
  const lead = leadBlock ? clip(stripInline(leadBlock.text), 120) : ''

  const points = headings
    .filter((h) => h.level === 2)
    .map((h) => stripInline(h.text).trim())
    .filter((t) => t.length >= 2 && t.length <= 26)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 4)

  const bodyParts = [lead]
  if (points.length) bodyParts.push(points.map((p) => `· ${p}`).join('\n'))
  const body = clip(bodyParts.filter(Boolean).join('\n\n'), 900) + (lead || points.length ? '\n\n完整内容在卡片里 →' : '')

  let tags = tagLineOf(cover.tags || doc.meta.tags.join(', '))
  if (!tags) {
    // 文末常见写法：#写作 #排版 #内容设计
    const tail = markdown
      .split(/\r?\n/)
      .slice(-4)
      .join(' ')
    const found = [...tail.matchAll(/#([^\s#]{1,20})/g)]
      .map((m) => m[1]!.trim())
      .filter((t) => t && !/^[#\s]/.test(t))
    tags = [...new Set(found)].slice(0, 5).join(', ')
  }

  const rawAuthor = stripInline(cover.author).trim()
  const mention = rawAuthor ? (rawAuthor.startsWith('@') ? rawAuthor : `@${rawAuthor}`) : ''

  return { title, body, tags, mention }
}
