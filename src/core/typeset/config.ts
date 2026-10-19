/**
 * 排版引擎权重表（CLREQ《中文排版需求》式常量）。
 * 全部为 em 相对量——随字号/字号比缩放自动等效。
 */
export interface TypesetConfig {
  /** 行末悬挂：全角闭合标点「。？！，”」计入行宽的比例（0.5 = 半字悬挂，墨迹恰齐右缘） */
  hangEndEm: number
  /** 行首悬挂：全角起始标点「（《“「」」计入行宽的比例（0.5 = 墨迹齐左缘） */
  hangStartEm: number
  /** 中西文之间的自动间隙（CLREQ 推荐 1/4 em） */
  autospaceEm: number
  /** 起伏软膝盖：单行 slack 超过此值开始加罚（em）——「略有起伏」的目标形态 */
  slackSoftEm: number
  /** 单行可容忍的最大 slack（em）：超过再叠重罚（长西文词兜底仍可达） */
  slackTolEm: number
}

export const DEFAULT_CONFIG: TypesetConfig = {
  hangEndEm: 0.5,
  hangStartEm: 0.5,
  autospaceEm: 0.25,
  slackSoftEm: 0.38,
  slackTolEm: 0.85,
}
