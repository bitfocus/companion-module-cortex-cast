/**
 * Minimal client for the Cortex Cast "Network Hotkeys" HTTP interface.
 *
 * From the Cortex Cast documentation (v2026.1, chapter 30):
 *   POST http://<cast-ip>:9250/hotkey/<ID>         toggles hotkey <ID> (H1, H2, ...)
 *   POST http://<cast-ip>:9250/hotkey/gethotkeys   lists all hotkeys
 * Both accept an empty body and reply with a JSON envelope:
 *   { "status": "success", "data": { ... }, "metadata": { "createdAt": "..." } }
 */

export interface CastAttachedItem {
	type: string
	name: string
}

export interface CastHotkey {
	id: string
	name: string
	attachedItem: CastAttachedItem | null
}

export interface CastTriggerResult extends CastHotkey {
	/** What happened when the hotkey was pressed, e.g. "stopped" when it was playing */
	action?: string
	postHotkeyAction?: string
}

interface CastEnvelope<T> {
	status?: string
	data?: T
	message?: string
	error?: string
}

export class CastApiError extends Error {}

export class CastClient {
	readonly #baseUrl: string
	readonly #timeoutMs: number

	constructor(host: string, port: number, timeoutMs = 3000) {
		const h = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host // bare IPv6
		this.#baseUrl = `http://${h}:${port}`
		this.#timeoutMs = timeoutMs
	}

	get baseUrl(): string {
		return this.#baseUrl
	}

	async getHotkeys(): Promise<CastHotkey[]> {
		const data = await this.#post<{ hotkeys?: unknown }>('/hotkey/gethotkeys')
		const list = Array.isArray(data?.hotkeys) ? data.hotkeys : []
		return list.map(normaliseHotkey).filter((h): h is CastHotkey => h !== null)
	}

	async triggerHotkey(id: string): Promise<CastTriggerResult | null> {
		const data = await this.#post<Record<string, unknown>>(`/hotkey/${encodeURIComponent(id)}`)
		const hotkey = normaliseHotkey(data)
		if (!hotkey) return null
		return {
			...hotkey,
			action: typeof data?.action === 'string' ? data.action : undefined,
			postHotkeyAction: typeof data?.postHotkeyAction === 'string' ? data.postHotkeyAction : undefined,
		}
	}

	async #post<T>(path: string): Promise<T | undefined> {
		let res: Response
		try {
			res = await fetch(this.#baseUrl + path, {
				method: 'POST',
				body: '', // Cast expects an (empty) body with a content-length header
				signal: AbortSignal.timeout(this.#timeoutMs),
			})
		} catch (e) {
			const err = e as Error & { cause?: { code?: string; message?: string; errors?: { code?: string }[] } }
			const reason =
				err.name === 'TimeoutError'
					? 'timed out'
					: (err.cause?.code ?? err.cause?.errors?.[0]?.code ?? err.cause?.message ?? err.message)
			throw new CastApiError(`Cannot reach Cast at ${this.#baseUrl} (${reason})`)
		}

		const text = await res.text()
		let body: CastEnvelope<T> | undefined
		try {
			body = text ? (JSON.parse(text) as CastEnvelope<T>) : undefined
		} catch {
			// Not JSON - fall through to status handling below
		}

		if (!res.ok || (body?.status && body.status !== 'success')) {
			const detail = body?.message ?? body?.error ?? (text.slice(0, 200) || res.statusText)
			throw new CastApiError(`Cast replied ${res.status} for ${path}: ${detail}`)
		}
		return body?.data
	}
}

function normaliseHotkey(raw: unknown): CastHotkey | null {
	if (!raw || typeof raw !== 'object') return null
	const r = raw as Record<string, unknown>
	if (typeof r.id !== 'string' || !r.id) return null

	let attachedItem: CastAttachedItem | null = null
	if (r.attachedItem && typeof r.attachedItem === 'object') {
		const a = r.attachedItem as Record<string, unknown>
		attachedItem = { type: asText(a.type), name: asText(a.name) }
	}
	return { id: r.id, name: typeof r.name === 'string' ? r.name : r.id, attachedItem }
}

/** Sort H1, H2, ... H10 numerically rather than as strings */
export function compareHotkeyIds(a: string, b: string): number {
	const na = Number(a.replace(/^\D+/, ''))
	const nb = Number(b.replace(/^\D+/, ''))
	if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
	return a.localeCompare(b)
}

/** Accept "H1", "h1" or "1" and return "H1" */
export function normaliseHotkeyId(input: unknown): string {
	const s = asText(input).trim()
	if (/^\d+$/.test(s)) return `H${s}`
	if (/^h\d+$/.test(s)) return s.toUpperCase()
	return s
}

function asText(v: unknown): string {
	return typeof v === 'string' || typeof v === 'number' ? String(v) : ''
}
