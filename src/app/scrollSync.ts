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
