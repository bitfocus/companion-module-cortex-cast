import {
	InstanceBase,
	InstanceStatus,
	type CompanionHTTPRequest,
	type CompanionHTTPResponse,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import { DEFAULT_PORT, GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { CastClient, compareHotkeyIds, normaliseHotkeyId, type CastHotkey } from './cast-api.js'

export type ModuleSchema = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

export type HotkeyState = 'playing' | 'stopped' | 'unknown'

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	config!: ModuleConfig // Setup in init()

	client: CastClient | null = null
	/** Hotkeys as last reported by Cast, sorted H1, H2, ... */
	hotkeys: CastHotkey[] = []
	/** Playing state per hotkey id, learned from trigger replies and webhooks */
	readonly states = new Map<string, HotkeyState>()

	#pollTimer: NodeJS.Timeout | undefined
	#hotkeySignature = ''
	#lastError = ''

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()
		await this.configUpdated(config)
	}

	async destroy(): Promise<void> {
		this.#stopPolling()
		this.client = null
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		this.#stopPolling()
		this.#lastError = ''

		const host = (config.host ?? '').trim()
		if (!host) {
			this.client = null
			this.updateStatus(InstanceStatus.BadConfig, 'Enter the IP address of the Cast PC')
			return
		}

		this.client = new CastClient(host, config.port || DEFAULT_PORT, config.timeout || 3000)
		this.updateStatus(InstanceStatus.Connecting)
		await this.refreshHotkeys()

		const seconds = Number(config.pollInterval ?? 10)
		if (seconds > 0) {
			this.#pollTimer = setInterval(() => void this.refreshHotkeys(), seconds * 1000)
		}
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	// ---------------------------------------------------------------- Cast calls

	/** Fetch the hotkey list from Cast and rebuild dropdowns/presets/variables if it changed */
	async refreshHotkeys(): Promise<boolean> {
		const client = this.client
		if (!client) return false
		try {
			const list = await client.getHotkeys()
			if (client !== this.client) return false // config changed while waiting
			list.sort((a, b) => compareHotkeyIds(a.id, b.id))
			this.hotkeys = list
			this.#setOk()

			const signature = JSON.stringify(list)
			if (signature !== this.#hotkeySignature) {
				this.#hotkeySignature = signature
				this.updateActions()
				this.updateFeedbacks()
				this.updatePresets()
				this.updateVariableDefinitions()
			}
			this.updateVariableValues()
			return true
		} catch (e) {
			if (client === this.client) this.#setError(e)
			return false
		}
	}

	/** Press (toggle) a hotkey in Cast */
	async triggerHotkey(rawId: unknown): Promise<void> {
		const id = normaliseHotkeyId(rawId)
		if (!id) {
			this.log('warn', 'Trigger hotkey: no hotkey ID given')
			return
		}
		if (!this.client) {
			this.log('warn', `Cannot trigger ${id}: no Cast IP configured`)
			return
		}
		try {
			const result = await this.client.triggerHotkey(id)
			this.#setOk()
			const action = result?.action ?? ''
			this.log('debug', `Triggered ${id}${action ? `: ${action}` : ''}`)

			// Cast reports "stopped" when a playing hotkey was toggled off; anything else means it started
			this.setHotkeyState(id, /stop/i.test(action) ? 'stopped' : 'playing')
			this.setVariableValues({
				last_hotkey_id: id,
				last_hotkey_name: result?.name ?? this.findHotkey(id)?.name ?? '',
				last_action: action,
			})
		} catch (e) {
			this.#setError(e)
			this.log('error', `Trigger ${id} failed: ${(e as Error).message}`)
		}
	}

	// ---------------------------------------------------------------- state

	findHotkey(id: string): CastHotkey | undefined {
		return this.hotkeys.find((h) => h.id === id)
	}

	getHotkeyState(id: string): HotkeyState {
		return this.states.get(id) ?? 'unknown'
	}

	setHotkeyState(id: string, state: HotkeyState): void {
		if (this.states.get(id) === state) return
		this.states.set(id, state)
		this.checkFeedbacks('hotkey_playing', 'any_hotkey_playing')
		this.updateVariableValues()
	}

	playingHotkeys(): string[] {
		return [...this.states.entries()]
			.filter(([, s]) => s === 'playing')
			.map(([id]) => id)
			.sort(compareHotkeyIds)
	}

	updateVariableValues(): void {
		const values: VariablesSchema = {
			hotkey_count: this.hotkeys.length,
			playing_hotkeys: this.playingHotkeys().join(', '),
		}
		for (const h of this.hotkeys) {
			values[`${h.id}_name`] = h.name
			values[`${h.id}_item`] = h.attachedItem?.name ?? ''
			values[`${h.id}_state`] = this.getHotkeyState(h.id)
		}
		this.setVariableValues(values)
	}

	// ---------------------------------------------------------------- webhooks

	/**
	 * Receives Cast's per-hotkey webhooks ("Hotkey Activated URL" / "Hotkey Deactivated URL"):
	 *   http://<companion>:8000/instance/<connection label>/activate/H1
	 *   http://<companion>:8000/instance/<connection label>/deactivate/H1
	 */
	handleHttpRequest(request: CompanionHTTPRequest): CompanionHTTPResponse {
		const parts = request.path.split('/').filter(Boolean)
		const [verb, rawId] = parts
		const id = normaliseHotkeyId(rawId ?? request.query.id ?? request.query.hotkey)

		const states: Record<string, HotkeyState> = {
			activate: 'playing',
			activated: 'playing',
			start: 'playing',
			deactivate: 'stopped',
			deactivated: 'stopped',
			stop: 'stopped',
		}
		const state = verb ? states[verb.toLowerCase()] : undefined

		if (!state || !id) {
			return {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					status: 'error',
					message: 'Use /activate/<hotkey id> or /deactivate/<hotkey id>, e.g. /activate/H1',
				}),
			}
		}

		this.log('debug', `Webhook: ${id} ${state}`)
		this.setHotkeyState(id, state)
		return {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status: 'success', id, state }),
		}
	}

	// ---------------------------------------------------------------- definitions

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	// ---------------------------------------------------------------- helpers

	#setOk(): void {
		if (this.#lastError) this.log('info', `Connected to Cast at ${this.client?.baseUrl}`)
		this.#lastError = ''
		this.updateStatus(InstanceStatus.Ok)
	}

	#setError(e: unknown): void {
		const message = (e as Error)?.message ?? String(e)
		if (message !== this.#lastError) this.log('warn', message)
		this.#lastError = message
		this.updateStatus(InstanceStatus.ConnectionFailure, message)
	}

	#stopPolling(): void {
		if (this.#pollTimer) clearInterval(this.#pollTimer)
		this.#pollTimer = undefined
	}
}
