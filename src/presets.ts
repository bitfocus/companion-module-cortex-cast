import { combineRgb, type CompanionPresetDefinitions, type CompanionPresetSection } from '@companion-module/base'
import type { ModuleSchema } from './main.js'
import type ModuleInstance from './main.js'
import { PLAYING_STYLE } from './feedbacks.js'

const IDLE = { color: combineRgb(255, 255, 255), bgcolor: combineRgb(0, 0, 0) }
const EMPTY = { color: combineRgb(110, 110, 110), bgcolor: combineRgb(0, 0, 0) }

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions<ModuleSchema> = {}
	const hotkeyPresetIds: string[] = []

	for (const h of self.hotkeys) {
		const presetId = `hotkey_${h.id}`
		hotkeyPresetIds.push(presetId)
		presets[presetId] = {
			type: 'simple',
			name: self.buttonLabel(h).replace(/\n/g, ' / '),
			style: {
				// Live text: follows renames/rebinds in Cast without re-dragging the preset
				text: `${h.id}\n$(${self.label}:${h.id}_label)`,
				size: 'auto',
				show_topbar: false,
				...(h.attachedItem ? IDLE : EMPTY),
			},
			steps: [
				{
					down: [{ actionId: 'trigger_hotkey', options: { hotkey: h.id, mode: 'toggle' } }],
					up: [],
				},
			],
			feedbacks: [{ feedbackId: 'hotkey_playing', options: { hotkey: h.id }, style: PLAYING_STYLE }],
		}
	}

	presets['stop_all'] = {
		type: 'simple',
		name: 'Stop all playing hotkeys',
		style: { text: 'STOP\nALL', size: 'auto', show_topbar: false, ...IDLE },
		steps: [{ down: [{ actionId: 'stop_all_hotkeys', options: {} }], up: [] }],
		feedbacks: [{ feedbackId: 'any_hotkey_playing', options: {}, style: PLAYING_STYLE }],
	}
	presets['refresh'] = {
		type: 'simple',
		name: 'Refresh hotkey list',
		style: { text: 'Refresh hotkeys', size: '14', show_topbar: false, ...IDLE },
		steps: [{ down: [{ actionId: 'refresh_hotkeys', options: {} }], up: [] }],
		feedbacks: [],
	}

	const structure: CompanionPresetSection<ModuleSchema>[] = [
		{
			id: 'hotkeys',
			name: 'Hotkeys',
			definitions: [
				{
					id: 'hotkeys',
					name: 'Hotkeys from Cast',
					description: hotkeyPresetIds.length
						? 'One button per hotkey, labelled from Cast. Turns red while playing.'
						: 'No hotkeys yet - connect to Cast, or press Refresh hotkeys.',
					type: 'simple',
					presets: hotkeyPresetIds,
				},
			],
		},
		{
			id: 'control',
			name: 'Control',
			definitions: [
				{
					id: 'control',
					name: 'Control',
					type: 'simple',
					presets: ['stop_all', 'refresh'],
				},
			],
		},
	]

	self.setPresetDefinitions(structure, presets)
}
