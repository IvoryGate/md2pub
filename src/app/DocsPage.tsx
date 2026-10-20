import { useEffect, useMemo, useRef } from 'react'
import MarkdownIt from 'markdown-it'
import katexPlugin from '@vscode/markdown-it-katex'
import hljs from 'highlight.js'
import { ArrowLeft, ArrowRight, BookOpen, Clock3, PenLine } from 'lucide-react'
import { GithubIcon } from './icons'
import { DOCS, SAMPLE_COVER, SAMPLE_DOC, SAMPLE_PUBLISH, docBySlug, type DocEntry } from '../content/docs'
import { GITHUB_URL } from '../content/site'
import { useStore } from '../store'

/* ---------- 文档渲染器（与卡片排版分开：文档要的是连续阅读） ---------- */
const docsMd = new MarkdownIt({ html: false, linkify: true })
docsMd.use(katexPlugin)

const defaultLinkOpen = docsMd.renderer.rules.link_open
docsMd.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx]?.attrGet('href') ?? ''
  if (/^[a-z0-9-]+\.md(#.*)?$/i.test(href)) {
    tokens[idx]?.attrSet('href', `#/docs/${href.replace(/\.md.*$/i, '')}`)
  } else if (/^https?:/i.test(href)) {
    tokens[idx]?.attrSet('target', '_blank')
    tokens[idx]?.attrSet('rel', 'noreferrer')
  }
  return defaultLinkOpen
    ? defaultLinkOpen(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options)
}

docsMd.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx]!
  const lang = token.info.trim().split(/\s+/)[0] ?? ''
  const code =
    lang && hljs.getLanguage(lang)
      ? hljs.highlight(token.content, { language: lang, ignoreIllegals: true }).value
      : docsMd.utils.escapeHtml(token.content)
  const label = lang ? `<span class="docs-code-lang">${docsMd.utils.escapeHtml(lang)}</span>` : ''
  return `<div class="docs-code">${label}<pre><code class="hljs">${code}</code></pre></div>`
}

const plainBody = (entry: DocEntry) =>
  entry.body
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
    .replace(/^#\s+.*\r?\n+/, '')
    .trim()

const metaOf = (entry: DocEntry) => {
  const chars = entry.body.replace(/\s/g, '').length
  const minutes = Math.max(1, Math.round(chars / 420))
  return { chars, minutes }
}

const loadSample = () => {
  if (!window.confirm('载入示例会替换编辑器里的当前内容，继续吗？')) return
  const st = useStore.getState()
  st.setMarkdown(SAMPLE_DOC)
  st.setCoverText({ ...SAMPLE_COVER })
  st.setPublish({ ...SAMPLE_PUBLISH })
  window.location.hash = '#/'
}

/* ---------- 页面 ---------- */
export const DocsPage = ({ slug }: { slug: string | null }) => {
  const entry = docBySlug(slug)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    rootRef.current?.scrollTo({ top: 0 })
  }, [slug])

  const html = useMemo(() => (entry ? docsMd.render(plainBody(entry)) : ''), [entry])

  const index = Math.max(0, DOCS.findIndex((d) => d.slug === slug))
  const prev = slug ? DOCS[index - 1] : undefined
  const next = slug ? DOCS[index + 1] : undefined

  return (
    <div ref={rootRef} className="docs-root">
      <header className="docs-topbar">
        <a href="#/" className="docs-brand" aria-label="回到编辑器">
          <span className="docs-mark">x2</span>
          <span className="docs-brand-name">md2pub</span>
          <span className="docs-brand-slash">/</span>
          <span className="docs-brand-section">文档</span>
        </a>
        <div className="flex-1" />
        <a href="#/" className="docs-toplink">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
          返回编辑器
        </a>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub 仓库"
          className="docs-toplink docs-toplink-gh docs-icon-link tip tip-b"
          data-tip="GitHub 仓库"
        >
          <GithubIcon className="h-4 w-4" />
        </a>
      </header>

      <div className="docs-shell">
        <aside className="docs-nav">
          <a href="#/docs" className={`docs-nav-home ${slug ? '' : 'on'}`}>
            <BookOpen className="h-3.5 w-3.5" strokeWidth={1.8} />
            文档首页
          </a>

          <div className="docs-nav-group">
            <div className="docs-nav-label">设计</div>
            {DOCS.filter((d) => d.eyebrow === '设计文档').map((d) => (
              <a key={d.slug} href={`#/docs/${d.slug}`} className={`docs-nav-item ${d.slug === slug ? 'on' : ''}`}>
                {d.title}
              </a>
            ))}
          </div>

          <div className="docs-nav-group">
            <div className="docs-nav-label">实现</div>
            {DOCS.filter((d) => d.eyebrow === '实现文档').map((d) => (
              <a key={d.slug} href={`#/docs/${d.slug}`} className={`docs-nav-item ${d.slug === slug ? 'on' : ''}`}>
                {d.title}
              </a>
            ))}
          </div>

          <div className="docs-nav-group">
            <div className="docs-nav-label">范例</div>
            {DOCS.filter((d) => d.eyebrow === '范例').map((d) => (
              <a key={d.slug} href={`#/docs/${d.slug}`} className={`docs-nav-item ${d.slug === slug ? 'on' : ''}`}>
                {d.title}
              </a>
            ))}
          </div>

          <div className="docs-nav-tip">
            文档与代码同步演进。
            <br />
            发现不一致，欢迎在 GitHub 提 issue。
          </div>
        </aside>

        <main className="docs-main">
          {!entry ? (
            <DocsIndex />
          ) : (
            <article>
              <div className="docs-article-head">
                <div className="docs-eyebrow">{entry.eyebrow}</div>
                <h1>{entry.title}</h1>
                <p className="docs-summary">{entry.summary}</p>
                <div className="docs-meta">
                  <span>
                    {metaOf(entry).chars.toLocaleString('zh-CN')} 字 · 约 {metaOf(entry).minutes} 分钟
                  </span>
                  {entry.sample && (
                    <button className="docs-load-btn" onClick={loadSample}>
                      <PenLine className="h-3.5 w-3.5" strokeWidth={1.8} />
                      载入编辑器
                    </button>
                  )}
                </div>
              </div>

              <div className="docs-prose" dangerouslySetInnerHTML={{ __html: html }} />

              <nav className="docs-pager">
                {prev ? (
                  <a href={`#/docs/${prev.slug}`} className="docs-pager-link">
                    <span className="docs-pager-dir">
                      <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
                      上一篇
                    </span>
                    <span className="docs-pager-title">{prev.title}</span>
                  </a>
                ) : (
                  <span />
                )}
                {next ? (
                  <a href={`#/docs/${next.slug}`} className="docs-pager-link docs-pager-next">
                    <span className="docs-pager-dir">
                      下一篇
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </span>
                    <span className="docs-pager-title">{next.title}</span>
                  </a>
                ) : (
                  <span />
                )}
              </nav>
            </article>
          )}
        </main>
      </div>
    </div>
  )
}

/* ---------- 文档首页 ---------- */
const DocsIndex = () => (
  <>
    <div className="docs-hero">
      <div className="docs-eyebrow">md2pub / documentation</div>
      <h1>把排版做成一门可解释的手艺</h1>
      <p>
        这里不写「怎么点按钮」，而是解释每个默认值从哪来、算法在权衡什么。
        文档与实现共用同一套约束：能说清楚的设计，才值得被复现。
      </p>
      <div className="docs-hero-meta">
        <span className="docs-chip">
          <Clock3 className="h-3.5 w-3.5" strokeWidth={1.8} /> 约 20 分钟读完
        </span>
        <span className="docs-chip">Markdown · 纯前端 · 可离线</span>
      </div>
    </div>

    <div className="docs-cards">
      {DOCS.map((d) => (
        <div key={d.slug} className="docs-card">
          <div className="docs-card-eyebrow">{d.eyebrow}</div>
          <a href={`#/docs/${d.slug}`} className="docs-card-link">
            <h2>{d.title}</h2>
            <p>{d.summary}</p>
          </a>
          <div className="docs-card-foot">
            <span>{metaOf(d).chars.toLocaleString('zh-CN')} 字</span>
            <div className="docs-card-actions">
              {d.sample && (
                <button className="docs-card-load" onClick={loadSample}>
                  载入编辑器
                </button>
              )}
              <a href={`#/docs/${d.slug}`} className="docs-card-read">
                阅读
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>

    <div className="docs-note">
      <strong>从哪里开始？</strong>
      想改版式，先读《排版设计》；想换配色，读《颜色设计》；想理解为什么分页会这样，读《排版算法》。
      《示例文档》展示了所有内容块在卡片里的实际形态，也可以一键载入编辑器。
    </div>
  </>
)
