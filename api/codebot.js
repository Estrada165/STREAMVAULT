// Vercel · POST /api/codebot   (ver server/codebot.js)
import { handle } from '../server/codebot.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ message: 'Método no permitido' }) }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const data = await handle(req.headers.authorization, body)
    res.status(200).json(data)
  } catch (e) {
    const status = e.status || 500
    if (status >= 500) console.error('codebot:', e.message)
    res.status(status).json({ message: e.message || 'Error interno', code: e.code || 'ERROR' })
  }
}
