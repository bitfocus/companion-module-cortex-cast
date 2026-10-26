// Mock of Cortex Cast's Network Hotkeys HTTP interface, shaped on the Cast documentation (chapter 30).
// Usage: node test/mock-cast.mjs [port]   (default 9250)
import http from 'node:http'

const hotkeys = [
	{ id: 'H1', name: 'Cortex Ads', attachedItem: { type: 'broadcast', name: 'Media: Cortex Adverts' } },
	{ id: 'H2', name: 'Goal!', attachedItem: { type: 'broadcast', name: 'Media: Goal_Celebration.mp4' } },
	{ id: 'H3', name: 'Nothing assigned', attachedItem: null },
	{ id: 'H10', name: 'Half Time', attachedItem: { type: 'playlist', name: 'Half Time Loop' } },
]
const playing = new Set()

export function startMockCast(port = 9250) {
	const server = http.createServer((req, res) => {
		let body = ''
		req.on('data', (c) => (body += c))
		req.on('end', () => {
			const send = (status, payload) => {
				res.writeHead(status, { 'Content-Type': 'application/json' })
				res.end(JSON.stringify(payload))
			}
			const meta = { createdAt: new Date().toISOString() }
			const m = /^\/hotkey\/([^/?]+)$/.exec(req.url ?? '')
			if (!m || !['GET', 'POST'].includes(req.method ?? '')) return send(404, { status: 'error', message: 'Not found' })

			if (m[1] === 'gethotkeys') return send(200, { status: 'success', data: { hotkeys }, metadata: meta })

			const hk = hotkeys.find((h) => h.id === decodeURIComponent(m[1]))
			if (!hk) return send(404, { status: 'error', message: `Hotkey ${m[1]} not found` })
			const action = playing.has(hk.id) ? 'stopped' : 'started'
			if (action === 'stopped') playing.delete(hk.id)
			else playing.add(hk.id)
			send(200, { status: 'success', data: { ...hk, action, postHotkeyAction: 'freeze' }, metadata: meta })
		})
	})
	return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)))
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const port = Number(process.argv[2] ?? 9250)
	await startMockCast(port)
	console.log(`Mock Cortex Cast listening on http://127.0.0.1:${port}`)
}
