/**
 * 编辑器 ↔ 卡片轨道 双向滚动同步总线。
 * 防回声：程序化设置 scrollTop 期间置 info.applying = true，
 * 处于该窗口内的 scroll 事件不再上报（50ms 冷却）。
 */
export type ScrollSource = 'editor' | 'rail'

export interface ScrollBus {
  info: { applying: boolean }
  report(source: ScrollSource, fraction: number): void
  on(fn: (source: ScrollSource, fraction: number) => void): () => void
}

export function createScrollBus(): ScrollBus {
  const subs = new Set<(source: ScrollSource, fraction: number) => void>()
  const info = { applying: false }
  return {
    info,
    report(source, fraction) {
      if (info.applying) return
      for (const fn of subs) fn(source, fraction)
    },
    on(fn) {
      subs.add(fn)
      return () => {
        subs.delete(fn)
      }
    },
  }
}

export type ScrollBusHandler = (
  el: HTMLElement,
  side: ScrollSource,
  bus: ScrollBus,
) => () => void

/** 归一化比例 ↔ scrollTop */
export const fractionOf = (el: HTMLElement): number => {
  const max = el.scrollHeight - el.clientHeight
  return max <= 0 ? 0 : Math.min(1, Math.max(0, el.scrollTop / max))
}

export const applyFraction = (el: HTMLElement | null, fraction: number): void => {
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  el.scrollTop = Math.max(0, Math.min(max, fraction * max))
}

/**
 * 接线一侧：el 滚动 → 上报；收到对侧滚动 → 程序化应用。
 * 通过返回的 cleanup 解除绑定（两侧各调用一次）。
 */
export const bindSyncScroll: ScrollBusHandler = (el, side, bus) => {
  const onScroll = () => bus.report(side, fractionOf(el))
  el.addEventListener('scroll', onScroll, { passive: true })

  const unsub = bus.on((src, f) => {
    if (src === side || bus.info.applying) return
    bus.info.applying = true
    applyFraction(el, f)
    window.setTimeout(() => {
      bus.info.applying = false
    }, 50)
  })

  return () => {
    el.removeEventListener('scroll', onScroll)
    unsub()
  }
}


/* ---------- 位置级联动（按源码行） ---------- */

export interface LineBus {
  info: { applying: boolean }
  /** line：源码行（0 基）；anchor：可见文字的归一化片段（用于跨分页精确对齐） */
  reportLine(source: ScrollSource, line: number, anchor?: string): void
  onLine(fn: (source: ScrollSource, line: number, anchor?: string) => void): () => void
}

export function createLineBus(): LineBus {
  const subs = new Set<(source: ScrollSource, line: number, anchor?: string) => void>()
  const info = { applying: false }
  return {
    info,
    reportLine(source, line, anchor) {
      if (info.applying) return
      for (const fn of subs) fn(source, line, anchor)
    },
    onLine(fn) {
      subs.add(fn)
      return () => {
        subs.delete(fn)
      }
    },
  }
}

/** 锚点归一化：只保留汉字/字母/数字，去掉 Markdown 标记与标点 */
export const normalizeAnchor = (s: string) => s.replace(/[^\p{Script=Han}A-Za-z0-9]/gu, '')

/** 归一化文本 + 到原文的字符索引映射（用于定位回源码位置） */
export const normalizeWithMap = (s: string) => {
  let out = ''
  const map: number[] = []
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!
    if (/[\p{Script=Han}A-Za-z0-9]/u.test(ch)) {
      out += ch
      map.push(i)
    }
  }
  return { out, map }
}


/** 缓动滚动（easeInOutCubic，接近贝塞尔手感） */
export function animateScroll(el: HTMLElement, target: number, duration = 380): Promise<void> {
  return new Promise((resolve) => {
    const start = el.scrollTop
    const delta = Math.max(0, target) - start
    if (Math.abs(delta) < 1) return resolve()
    const t0 = performance.now()
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      el.scrollTop = start + delta * ease(p)
      if (p < 1) requestAnimationFrame(step)
      else resolve()
    }
    requestAnimationFrame(step)
  })
}
