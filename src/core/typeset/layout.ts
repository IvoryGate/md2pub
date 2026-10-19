/**
 * KP 型断行求解器：以「整段最优」为目标，松弛量按平方代价在全段均衡分布。
 *
 * 核心机制（CLREQ《中文排版需求》）：
 * - 禁则：闭合标点不能起行、起始标点不能悬行尾
 * - 行末/行首标点悬挂：闭合标点行末只计半宽（墨迹齐缘、空白半溢出）
 * - 标点挤压池：版内全角标点的空白半是可压缩弹性——
 *     闭合标点右空白 0.5em（后随内容、非行末）
 *     起始标点左空白 0.5em（前有内容、非行首）
 *     与标点相邻时机会减半 0.25em（接触面共享）
 *   池让行宽从「整字量子化」变连续，是消灭中文行尾大洞的主力机制。
 *   DP 池与渲染分配共用同一套机会枚举（逐像素同源，只扣不渲会溢出）。
 * - 中西文自动间隙（显式建模，行首/行尾自动修剪）
 * - 拉丁词整词不可拆（超长 URL 的内部强拆仅溢出兜底时可选）
 *
 * DP 求 min Σ slack²：洞均摊为整段一致的呼吸感（浏览器 greedy 永远给不出）。
 */
import type { Token } from './itemize'
import type { TypesetConfig } from './config'

export interface TypesetSeg {
  run: number
  text: string
  /** 中西文间隙 px（渲染为独立 spacer，排在该段之后） */
  gapAfter?: number
  /** 挤压落地：该段左移/右移 px（margin 负值） */
  shiftLeft?: number
  shiftRight?: number
}

export interface TypesetLine {
  /** [start, end) token 区间（含空白，渲染时修剪） */
  from: number
  to: number
  segs: TypesetSeg[]
  /** 预算宽 px */
  width: number
  /** 行首悬挂 px（作用于首段） */
  hangStartPx: number
}

export interface TypesetResult {
  lines: TypesetLine[]
  totalCost: number
}

const INF = 1e12

interface SolveConfig extends TypesetConfig {
  overflow: 'forbid' | 'penalize'
}

/** 机会上限（em）：闭合标点右空白 / 起始标点左空白 */
const OPP_EM = 0.5
const OPP_TOUCH_EM = 0.25

export function layout(tokens: Token[], targetWidth: number, em: number, cfg: SolveConfig): TypesetResult {
  const n = tokens.length
  if (n === 0) return { lines: [], totalCost: 0 }

  // ---- 预处理：前缀宽 + 四类机会前缀计数（DP 与组装共用口径）----
  const pref = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) pref[i + 1] = pref[i]! + tokens[i]!.w + (tokens[i]!.gapAfter ?? 0)

  // R 机会：fw 闭合标点 k（后随 token 存在）；L 机会：fw 起始标点 k（前有 token）
  // 与标点相邻（接触面共享）→ 上限减半
  const cnt = {
    rFull: new Int32Array(n + 1),
    rHalf: new Int32Array(n + 1),
    lFull: new Int32Array(n + 1),
    lHalf: new Int32Array(n + 1),
  }
  for (let k = 0; k < n; k++) {
    const t = tokens[k]!
    const nextPunct = k + 1 < n && tokens[k + 1]!.punct === true
    const prevPunct = k > 0 && tokens[k - 1]!.punct === true
    cnt.rFull[k + 1] = cnt.rFull[k]! + (t.hangEnd && !nextPunct ? 1 : 0)
    cnt.rHalf[k + 1] = cnt.rHalf[k]! + (t.hangEnd && nextPunct ? 1 : 0)
    cnt.lFull[k + 1] = cnt.lFull[k]! + (t.hangStart && !prevPunct ? 1 : 0)
    cnt.lHalf[k + 1] = cnt.lHalf[k]! + (t.hangStart && prevPunct ? 1 : 0)
  }

  const isBlank = (k: number) => tokens[k]!.blank === true
  const content = (i: number, j: number): [number, number] => {
    let ci = i
    let cj = j
    while (ci < cj && isBlank(ci)) ci++
    while (cj > ci && isBlank(cj - 1)) cj--
    return [ci, cj]
  }

  /** 行 [ci,cj) 的挤压池 px（口径 = 组装枚举，见 opps()） */
  const poolOf = (ci: number, cj: number): number => {
    if (cj - ci < 2) return 0
    const rF = cnt.rFull[cj - 1]! - cnt.rFull[ci]! // R 机会 k ∈ [ci, cj-2]
    const rH = cnt.rHalf[cj - 1]! - cnt.rHalf[ci]!
    const lF = cnt.lFull[cj]! - cnt.lFull[ci + 1]! // L 机会 k ∈ [ci+1, cj-1]
    const lH = cnt.lHalf[cj]! - cnt.lHalf[ci + 1]!
    return (rF + lF) * OPP_EM * em + (rH + lH) * OPP_TOUCH_EM * em
  }

  /** 组装用的机会枚举（与 poolOf 同口径） */
  const oppsOf = (ci: number, cj: number): Array<{ k: number; side: 'L' | 'R'; max: number }> => {
    const opps: Array<{ k: number; side: 'L' | 'R'; max: number }> = []
    for (let k = ci; k < cj; k++) {
      const t = tokens[k]!
      if (t.hangEnd && k < cj - 1) opps.push({ k, side: 'R', max: (tokens[k + 1]!.punct ? OPP_TOUCH_EM : OPP_EM) * em })
      if (t.hangStart && k > ci) opps.push({ k, side: 'L', max: (tokens[k - 1]!.punct ? OPP_TOUCH_EM : OPP_EM) * em })
    }
    return opps
  }

  /** 行 [i,j) 预算宽：修剪空白、首末悬挂、行尾 gap 去除（挤压在代价层动态使用） */
  const budget = (i: number, j: number): number => {
    const [ci, cj] = content(i, j)
    if (ci >= cj) return 0
    let w = pref[cj]! - pref[ci]!
    const lastT = tokens[cj - 1]!
    const firstT = tokens[ci]!
    if (lastT.gapAfter) w -= lastT.gapAfter
    if (firstT.hangStart) w -= Math.round(firstT.hangStart * em)
    if (lastT.hangEnd) w -= Math.round(lastT.hangEnd * em)
    return w
  }

  const breakable = (j: number) => j >= n || (tokens[j - 1]!.canEnd && tokens[j]!.canStart)

  const slackR = (d: number) => {
    const r = d / em
    return r * r
  }

  const solve = (overflowFree: boolean): { cost: Float64Array; prev: Int32Array } => {
    const cost = new Float64Array(n + 1).fill(INF)
    const prev = new Int32Array(n + 1).fill(-1)
    cost[n] = 0
    for (let i = n - 1; i >= 0; i--) {
      for (let j = i + 1; j <= n; j++) {
        if (j < n && !breakable(j)) continue
        const [ci, cj] = content(i, j)
        if (ci >= cj) continue
        const bw = budget(i, j)
        const d = targetWidth - bw
        // 挤压池吸收超宽（正 slack 无法被挤压消化，只能靠断点选择消解）
        const poolPx = poolOf(ci, cj)
        const residual = d + Math.min(Math.max(0, -d), poolPx)
        const overflowTol = cfg.overflowTolEm * em
        let c = 0
        if (j >= n) {
          // 段尾行：长度无要求（短句自然），但**必须装得下**——漏掉这条，
          // DP 会把整段塞进「末行」（代价 0）导致整段一行溢出。
          if (residual < -overflowTol) {
            if (!overflowFree) continue
            c += slackR(-residual) * 100 + 1e6
          } else if (bw < targetWidth * 0.18) c += 8 /* 避免一字尾 */
        } else {
          c = slackR(residual > 0 ? residual : 0)
          if (residual > cfg.slackSoftEm * em) c += 3 * slackR(residual - cfg.slackSoftEm * em)
          if (residual > cfg.slackTolEm * em) c += 10 * slackR(residual - cfg.slackTolEm * em)
          // 明显空洞（>0.55em）二次重罚：只要存在可行断点就一定消灭
          if (residual > 0.55 * em) c += 12 * slackR(residual - 0.55 * em)
          // 强拆点出现在断点边缘才罚（词内保留不受罚）
          if (tokens[j - 1]!.intra || tokens[j]!.intra) c += 1e4
          if (residual < -overflowTol) {
            if (!overflowFree) continue
            c += slackR(-residual) * 100 + 1e6
          }
        }
        const total = cost[j]! + c
        if (total < cost[i]!) {
          cost[i] = total
          prev[i] = j
        }
      }
    }
    return { cost, prev }
  }

  let { cost, prev } = solve(false)
  if (cost[0]! >= INF) {
    ;({ cost, prev } = solve(true))
  }

  // ---- 组装行（挤压落地渲染）----
  const lines: TypesetLine[] = []
  let i = 0
  while (i < n) {
    let j = prev[i]!
    if (j <= i) {
      // 极端兜底：贪心向右推进
      j = i + 1
      while (j < n && !breakable(j)) j++
    }
    const [ci, cj] = content(i, j)
    const bw = budget(i, j)
    const d = targetWidth - bw
    // 挤压分配：只用于吸收超宽；均匀分摊（每机会 ≤ 各自上限）
    const opps = oppsOf(ci, cj)
    const poolPx = opps.reduce((a, o) => a + o.max, 0)
    const used = Math.min(Math.max(0, -d), poolPx)
    const per = opps.length ? used / opps.length : 0

    const segs: TypesetSeg[] = []
    for (let k = ci; k < cj; k++) {
      const t = tokens[k]!
      const opp = opps.find(o => o.k === k)
      const s = opp ? Math.min(opp.max, per) : 0
      const lastSeg = segs[segs.length - 1]
      const mergeable = s === 0 && lastSeg && lastSeg.run === t.run && lastSeg.gapAfter === undefined && lastSeg.shiftLeft === undefined && lastSeg.shiftRight === undefined
      if (mergeable) lastSeg.text += t.text
      else {
        const seg: TypesetSeg = { run: t.run, text: t.text }
        if (s > 0) {
          if (opp!.side === 'L') seg.shiftLeft = +s.toFixed(2)
          else seg.shiftRight = +s.toFixed(2)
        }
        segs.push(seg)
      }
      if (k < cj - 1 && t.gapAfter) segs.push({ run: t.run, text: '', gapAfter: t.gapAfter })
    }

    const firstT = tokens[ci]!
    const hangStartPx = firstT.hangStart ? Math.round(firstT.hangStart * em) : 0
    lines.push({ from: i, to: j, segs, width: bw, hangStartPx })
    i = j
  }

  return { lines, totalCost: cost[0]! >= INF ? NaN : cost[0]! }
}
