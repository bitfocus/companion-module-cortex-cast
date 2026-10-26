// Fake Cortex Cast for testing the Companion module without the real software.
// Mimics Cast's Network Hotkeys HTTP interface as described in the Cast documentation (chapter 30).
//
// Usage:
//   node mock-cast.mjs                  same PC as Companion  -> set module IP to 127.0.0.1
//   node mock-cast.mjs --lan            another PC on the LAN -> set module IP to this PC's IP
//   node mock-cast.mjs --port 9251      use a different port
//   node mock-cast.mjs --webhooks http://127.0.0.1:8000/instance/cortex-cast
//                                       also send Cast-style webhooks to Companion on every start/stop
//
// While it runs, type a hotkey ID (e.g. H2) and press Enter to toggle it "from Cast",
// as if someone pressed the key on the Cast PC.
import http from 'node:http'
import os from 'node:os'
import readline from 'node:readline'

const hotkeys = [
	{ id: 'H1', name: 'Cortex Ads', attachedItem: { type: 'broadcast', name: 'Media: Cortex Adverts' } },
	{ id: 'H2', name: 'Goal!', attachedItem: { type: 'broadcast', name: 'Media: Goal Celebration' } },
	{ id: 'H3', name: 'Nothing assigned', attachedItem: null },
	{ id: 'H10', name: 'Half Time', attachedItem: { type: 'playlist', name: 'Half Time Loop' } },
]
const playing = new Set()
let webhookBase = ''
let webhookLog = () => {}

function toggle(hk) {
	const action = playing.has(hk.id) ? 'stopped' : 'started'
	if (action === 'stopped') playing.delete(hk.id)
	else playing.add(hk.id)
	if (webhookBase) {
		// Like Cast's "Hotkey Activated/Deactivated URL" settings
		const url = `${webhookBase}/${action === 'started' ? 'activate' : 'deactivate'}/${hk.id}`
		fetch(url, { signal: AbortSignal.timeout(3000) })
			.then((r) => webhookLog(`  webhook GET ${url} -> ${r.status}`))
			.catch((e) => webhookLog(`  webhook GET ${url} FAILED: ${e.cause?.code ?? e.message}`))
	}
	return action
}

export function startMockCast(port = 9250, host = '127.0.0.1', log = () => {}) {
	const server = http.createServer((req, res) => {
		req.resume()
		req.on('end', () => {
			const send = (status, payload) => {
				res.writeHead(status, { 'Content-Type': 'application/json' })
				res.end(JSON.stringify(payload))
			}
			const meta = { createdAt: new Date().toISOString() }
			const m = /^\/hotkey\/([^/?]+)$/.exec(req.url ?? '')
			if (!m || !['GET', 'POST'].includes(req.method ?? '')) {
				log(`${req.method} ${req.url} -> 404`)
				return send(404, { status: 'error', message: 'Not found' })
			}

			if (m[1] === 'gethotkeys') {
				log(`${req.method} ${req.url} -> hotkey list`)
				return send(200, { status: 'success', data: { hotkeys }, metadata: meta })
			}

			const hk = hotkeys.find((h) => h.id === decodeURIComponent(m[1]))
			if (!hk) {
				log(`${req.method} ${req.url} -> 404 (no such hotkey)`)
				return send(404, { status: 'error', message: `Hotkey ${m[1]} not found` })
			}
			const action = toggle(hk)
			log(
				`${req.method} ${req.url} -> ${hk.id} "${hk.name}" ${action.toUpperCase()}   playing: [${[...playing].join(', ')}]`,
			)
			send(200, { status: 'success', data: { ...hk, action, postHotkeyAction: 'freeze' }, metadata: meta })
		})
	})
	return new Promise((resolve, reject) => {
		server.once('error', reject)
		server.listen(port, host, () => resolve(server))
	})
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('mock-cast.mjs')) {
	const args = process.argv.slice(2)
	const lan = args.includes('--lan')
	const pi = args.indexOf('--port')
	const port = pi >= 0 ? Number(args[pi + 1]) : 9250
	const host = lan ? '0.0.0.0' : '127.0.0.1'
	const time = () => new Date().toLocaleTimeString()
	const wi = args.indexOf('--webhooks')
	if (wi >= 0) {
		webhookBase = String(args[wi + 1] ?? '').replace(/\/+$/, '')
		webhookLog = (msg) => console.log(`${time()}  ${msg}`)
	}

	try {
		await startMockCast(port, host, (msg) => console.log(`${time()}  ${msg}`))
	} catch (e) {
		console.error(
			`Could not start on port ${port}: ${e.code === 'EADDRINUSE' ? 'port already in use (is Cast or another mock running?)' : e.message}`,
		)
		process.exit(1)
	}

	console.log(`\nFake Cortex Cast running on port ${port}`)
	if (lan) {
		const ips = Object.values(os.networkInterfaces())
			.flat()
			.filter((i) => i && i.family === 'IPv4' && !i.internal)
			.map((i) => i.address)
		console.log(`In Companion, set the Cast IP to one of: ${ips.join(', ') || '(no network found)'}`)
	} else {
		console.log('In Companion, set the Cast IP to 127.0.0.1  (add --lan to run on a different PC)')
	}
	console.log(
		webhookBase
			? `Webhooks: sending to ${webhookBase}/activate|deactivate/<ID>`
			: 'Webhooks: off (add --webhooks http://127.0.0.1:8000/instance/<connection label>)',
	)
	console.log(`Hotkeys: ${hotkeys.map((h) => `${h.id} "${h.name}"`).join(', ')}`)
	console.log('Type a hotkey ID and press Enter to toggle it from "Cast". Ctrl+C to quit.\n')

	readline.createInterface({ input: process.stdin }).on('line', (line) => {
		const id = line.trim().toUpperCase()
		if (!id) return
		const hk = hotkeys.find((h) => h.id === id)
		if (!hk) return console.log(`No hotkey ${id}`)
		const action = toggle(hk)
		console.log(
			`${time()}  [keyboard] ${hk.id} "${hk.name}" ${action.toUpperCase()}   playing: [${[...playing].join(', ')}]`,
		)
	})
}
