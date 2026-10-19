import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * 本地导出端点（仅 dev server）：把 PNG 直接写进项目 exports/ 目录。
 * 用途：浏览器原生目录选择器 / 下载目录在部分环境（自动化、远程浏览器）不可用时，
 * 仍能把成品图落到用户可访问的本地磁盘。
 * 安全边界：只允许写入 `<项目>/exports` 内，禁止路径穿越。
 */
const md2pubExportPlugin = (): Plugin => ({
  name: 'md2pub-export',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__md2pub/export', async (req, res) => {
      const json = (status: number, body: unknown) => {
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(body))
      }
      if (req.method === 'GET') return json(200, { ok: true, dev: true })
      if (req.method !== 'POST') return json(405, { ok: false, error: 'POST only' })
      try {
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(Buffer.from(c))
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
          dir?: unknown
          files?: Array<{ name?: unknown; data?: unknown }>
        }
        const root = path.resolve(process.cwd(), 'exports')
        const sub = typeof body.dir === 'string' ? body.dir.trim() : ''
        const dir = sub ? path.resolve(root, sub) : root
        if (dir !== root && !dir.startsWith(root + path.sep)) return json(400, { ok: false, error: '非法目录' })
        const files = Array.isArray(body.files) ? body.files : []
        if (!files.length) return json(400, { ok: false, error: '没有文件' })
        if (files.length > 300) return json(400, { ok: false, error: '文件过多' })
        await fs.mkdir(dir, { recursive: true })
        let bytes = 0
        for (const f of files) {
          const name = String(f?.name ?? '')
          const data = String(f?.data ?? '')
          if (!name || /[\\/]/.test(name) || name.includes('..')) return json(400, { ok: false, error: `非法文件名：${name}` })
          if (!data) return json(400, { ok: false, error: `空文件：${name}` })
          const buf = Buffer.from(data, 'base64')
          bytes += buf.length
          if (bytes > 300 * 1024 * 1024) return json(400, { ok: false, error: '导出体积超限（300MB）' })
          await fs.writeFile(path.join(dir, name), buf)
        }
        return json(200, { ok: true, dir, rel: path.relative(process.cwd(), dir), count: files.length })
      } catch (err) {
        return json(400, { ok: false, error: String((err as Error)?.message ?? err) })
      }
    })
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), md2pubExportPlugin()],
  base: '/md2pub/',
})
