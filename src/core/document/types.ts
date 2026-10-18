/**
 * 平台无关的中间文档模型（IDM）。
 * 约束：
 * - core 层不 import 任何平台目录或 UI 代码；
 * - 平台渲染器只允许消费 Document，不允许接触原始 markdown；
 * - `---` 保持 markdown 原生语义（thematic break → divider），不用作分页符。
 *   显式分页请用 `<!-- pagebreak -->` / `<!-- newpage -->`（会被解析为 pagebreak 块）。
 */

/** front-matter 元信息 */
export interface DocMeta {
  title?: string
  /** 小红书/公众号共用的标签（小红书侧额外有内置 tag 池） */
  tags: string[]
  author?: string
  cover?: string
}

/** 结构化内容块（图片/公式/图表/分割线/分页符均为一等公民） */
export type Block =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  /** 行内 markdown 保留原文，由平台渲染器用共享行内渲染器（含 KaTeX）输出 HTML */
  | { type: 'paragraph'; text: string }
  /** 多行文本按 \n 分隔，渲染时逐行行内渲染 */
  | { type: 'quote'; text: string }
  | { type: 'code'; lang?: string; text: string }
  | { type: 'math'; text: string }
  | { type: 'mermaid'; text: string }
  | { type: 'plantuml'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'divider' }
  | { type: 'pagebreak' }

export interface Document {
  meta: DocMeta
  /** 顺序化内容块（未分页；分页由平台 layout 按排版参数计算） */
  blocks: Block[]
}
