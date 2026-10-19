/**
 * 分词器：带样式的 InlineRun 流 → 排版 token 流。
 *
 * token 携带断行决策所需的全部排版属性（CLREQ《中文排版需求》）：
 * - canStart / canEnd：行首禁则（。？！不能起行）、行末禁则（《「（不能悬行尾）
 * - hangEnd / hangStart：全角标点半字悬挂配额
 * - contact：全角标点接触挤压配额（分割挤压，两两取小）
 * - intra：拉丁长词内部强拆点（仅溢出兜底时可选）
 * - gapAfter：中西文自动间隙（引擎显式建模；显式空格处不重复加）
 *
 * 引擎对视觉一无所知：runs 只带 kind 决定字体，平台负责 kind → CSS。
 */
import { advanceWidth, TypesetFont } from './measure'
import type { TypesetConfig } from './config'

export type RunKind = string

export interface TypesetRun {
  text: string
  kind: RunKind
  /** 原始 HTML 属性（平台重建标签用，引擎透传） */
  attrs?: Record<string, string>
  /** 行内元素饰带（如 code 的水平 padding+border），归入 run 首末 token 预算 */
  padStart?: number
  padEnd?: number
}

export interface Token {
  text: string
  /** 前进宽度 px（含字距与饰带） */
  w: number
  run: number
  canStart: boolean
  canEnd: boolean
  /** 全角闭合标点：行末半字悬挂标记（兼作挤压池 R 机会标记） */
  hangEnd?: number
  /** 全角起始标点：行首半字悬挂标记（兼作挤压池 L 机会标记） */
  hangStart?: number
  /** 与下一 token 之间的中西文间隙 px */
  gapAfter?: number
  /** 拉丁长词内部强拆点（溢出兜底） */
  intra?: boolean
  /** 空白 token（行组装时修剪） */
  blank?: boolean
  /** 全角标点 */
  punct?: boolean
}

/* 全角闭合标点（可行末半字悬挂；行首禁则） */
const CLOSE_FW = new Set('。，、；：？！）】》」』…％‰'.split(''))
/* 全角起始标点（可行首半字悬挂；行末禁则） */
const OPEN_FW = new Set('（《「『〔'.split(''))
/* ASCII 半角标点：行首禁则、不悬挂 */
const ASCII_CLOSE = new Set('.,;:!?)]}'.split(''))
const ASCII_OPEN = new Set('([{'.split(''))

const isClose = (ch: string) => CLOSE_FW.has(ch) || ASCII_CLOSE.has(ch)
const isOpen = (ch: string) => OPEN_FW.has(ch) || ASCII_OPEN.has(ch)
/* CJK 表意/假名/全角/引号-省略破折区段（字与字之间可断行） */
const isCJK = (ch: string) => {
  const c = ch.charCodeAt(0)
  return (
    (c >= 0x2e80 && c <= 0x9fff) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xff00 && c <= 0xffef) ||
    (c >= 0x3000 && c <= 0x303f) ||
    (c >= 0x3040 && c <= 0x30ff) ||
    (c >= 0x2018 && c <= 0x201d) ||
    c === 0x2026 ||
    c === 0x2014
  )
}
const isFullwidth = (ch: string) =>
  (ch.charCodeAt(0) >= 0xff00 && ch.charCodeAt(0) <= 0xffef) || CLOSE_FW.has(ch) || OPEN_FW.has(ch)
/* 拉丁词字符（. 仅数字小数点并入；% 等常用符号并入词） */
const isWordChar = (ch: string) => /[A-Za-z0-9'’_\-+/&@#$]/.test(ch)
const isSpace = (ch: string) => ch === ' ' || ch === '\u3000'

/**
 * runs → tokens。
 * - CJK 逐字成 token（无 kerning，逐字测量 = 整行宽）
 * - 拉丁词默认整词成 token（整词测量保 kerning）；仅超长词（URL 兜底）切成带 intra 标记的片
 * - 全角标点成单 token，挂禁则/悬挂/接触属性
 */
export function itemize(runs: TypesetRun[], font: (kind: RunKind) => TypesetFont, em: number, cfg: TypesetConfig): Token[] {
  const raw: Array<[number, Token]> = []

  runs.forEach((run, ri) => {
    const f = font(run.kind)
    const text = run.text
    let i = 0
    while (i < text.length) {
      const ch = text[i]!
      if (isSpace(ch)) {
        raw.push([ri, { text: ch, w: advanceWidth(ch, f), run: ri, canStart: false, canEnd: true, blank: true }])
        i++
        continue
      }
      if (isOpen(ch) || isClose(ch)) {
        const fw = isFullwidth(ch)
        const open = isOpen(ch)
        raw.push([
          ri,
          {
            text: ch,
            w: advanceWidth(ch, f),
            run: ri,
            punct: true,
            // 禁则：闭合标点（。，）不能起行；起始标点（（《）不能悬行尾
            canStart: open,
            canEnd: !open,
            ...(fw && open ? { hangStart: cfg.hangStartEm } : {}),
            ...(fw && !open ? { hangEnd: cfg.hangEndEm } : {}),
          },
        ])
        i++
        continue
      }
      if (isCJK(ch)) {
        raw.push([ri, { text: ch, w: advanceWidth(ch, f), run: ri, canStart: true, canEnd: true }])
        i++
        continue
      }
      // 拉丁词/数字/URL：整词测量（kerning 精确）
      let j = i
      let word = ''
      while (j < text.length) {
        const c2 = text[j]!
        if (isSpace(c2) || isClose(c2) || isOpen(c2) || isCJK(c2)) break
        if (c2 === '.' && !(/[0-9]/.test(text[j - 1] ?? '') && /[0-9]/.test(text[j + 1] ?? ''))) break
        if (!isWordChar(c2)) break
        word += c2
        j++
      }
      if (word) {
        const w = advanceWidth(word, f)
        if (w > em * 3.5 && word.length > 6) {
          // 超长词（URL 兜底）：切成片，每片允许前后强拆（重罚仅由 DP 的 intra demerits 施加）
          const per = Math.ceil(word.length / Math.ceil(w / (em * 1.2)))
          for (let k = 0; k < word.length; k += per) {
            raw.push([
              ri,
              {
                text: word.slice(k, k + per),
                w: advanceWidth(word.slice(k, k + per), f),
                run: ri,
                canStart: true,
                canEnd: true,
                intra: true,
              },
            ])
          }
        } else {
          raw.push([ri, { text: word, w, run: ri, canStart: true, canEnd: true }])
        }
        i = j
      } else {
        // 未知字符：宽度和普通 token 同权
        raw.push([ri, { text: ch, w: advanceWidth(ch, f), run: ri, canStart: true, canEnd: true }])
        i++
      }
    }
  })

  const tokens = raw.map(([, t]) => t)

  // 中西文自动间隙：CJK↔拉丁直连（无空白、非标点）显式建模；渲染为独立 spacer
  const gapPx = em * cfg.autospaceEm
  for (let k = 0; k < tokens.length - 1; k++) {
    const a = tokens[k]!
    const b = tokens[k + 1]!
    if (a.blank || b.blank || a.punct || b.punct) continue
    const aCJK = isCJK(a.text[a.text.length - 1]!)
    const bCJK = isCJK(b.text[0]!)
    if (aCJK !== bCJK) a.gapAfter = gapPx
  }

  // 饰带归位：padStart → run 第一个 token；padEnd → run 最后一个 token
  const first: Map<number, Token> = new Map()
  const last: Map<number, Token> = new Map()
  tokens.forEach(t => {
    if (!first.has(t.run)) first.set(t.run, t)
    last.set(t.run, t)
  })
  runs.forEach((run, ri) => {
    const a = first.get(ri)
    const b = last.get(ri)
    if (a && run.padStart) a.w += run.padStart
    if (b && run.padEnd) b.w += run.padEnd
  })

  return tokens
}
