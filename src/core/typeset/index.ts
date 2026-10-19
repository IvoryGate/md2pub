/**
 * 中文精品排版引擎（KP 型全局最优断行）。
 *
 * 职责边界（高内聚低耦合）：
 * - 本目录是纯计算层：输入 runs/宽度/字体，输出断好的行；不碰 React、不碰平台样式
 * - 平台层负责两侧翻译：
 *     上游：目标平台的行内 HTML 解析 → TypesetRun[]（带 kind）
 *     下游：TypesetLine 的段 → 重建带样式的行 HTML
 */
export * from './config'
export * from './measure'
export * from './itemize'
export * from './layout'
