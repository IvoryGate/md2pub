import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import json from 'highlight.js/lib/languages/json'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import php from 'highlight.js/lib/languages/php'
import ruby from 'highlight.js/lib/languages/ruby'
import kotlin from 'highlight.js/lib/languages/kotlin'
import swift from 'highlight.js/lib/languages/swift'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import diff from 'highlight.js/lib/languages/diff'
import ini from 'highlight.js/lib/languages/ini'
import markdown from 'highlight.js/lib/languages/markdown'
import plaintext from 'highlight.js/lib/languages/plaintext'

/**
 * 编辑模式代码块部件的语法高亮（highlight.js + Phycat 配色）。
 * 按需注册常用语言（tree-shaking friendly），未注册语言回退纯文本转义。
 */

const LANGS = [
  ['javascript', javascript],
  ['typescript', typescript],
  ['python', python],
  ['json', json],
  ['css', css],
  ['xml', xml],
  ['yaml', yaml],
  ['bash', bash],
  ['sql', sql],
  ['java', java],
  ['cpp', cpp],
  ['csharp', csharp],
  ['go', go],
  ['rust', rust],
  ['php', php],
  ['ruby', ruby],
  ['kotlin', kotlin],
  ['swift', swift],
  ['dockerfile', dockerfile],
  ['diff', diff],
  ['ini', ini],
  ['markdown', markdown],
  ['plaintext', plaintext],
] as const

for (const [name, def] of LANGS) hljs.registerLanguage(name, def)

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * 把整段高亮 HTML 拆成逐行（行数组每项都是可直接 innerHTML 的片段）。
 * 拆分点在 tag 外的换行处；切进行内的 open span 在行尾关闭、下一行重新打开，
 * 保证每行 HTML 自闭合（跨行字符串/块注释的颜色得以延续）。
 */
const splitHighlightedLines = (html: string): string[] => {
  const lines: string[] = []
  let out = ''
  const stack: string[] = []
  let i = 0
  while (i < html.length) {
    if (html[i] === '<') {
      const j = html.indexOf('>', i) + 1
      const tag = html.slice(i, j)
      out += tag
      if (tag.startsWith('</')) stack.pop()
      else if (!tag.endsWith('/>')) stack.push(tag)
      i = j
      continue
    }
    const j = html.indexOf('\n', i)
    if (j === -1) {
      out += html.slice(i)
      break
    }
    out += html.slice(i, j)
    const close = stack
      .map((t) => `</${/^<\s*([a-zA-Z0-9]+)/.exec(t)?.[1] ?? 'span'}>`)
      .reverse()
      .join('')
    lines.push(out + close)
    out = stack.join('')
    i = j + 1
  }
  lines.push(out)
  return lines
}

/** 代码文本 → 逐行高亮 HTML（空行 → &nbsp; 占位保住行高） */
export const highlightCodeLines = (lang: string, text: string): string[] => {
  const language = hljs.getLanguage(lang) ? lang : 'plaintext'
  try {
    const res = hljs.highlight(text, { language, ignoreIllegals: true })
    return splitHighlightedLines(res.value).map((s) => s || '&nbsp;')
  } catch {
    return text.split('\n').map((ln) => esc(ln) || '&nbsp;')
  }
}
