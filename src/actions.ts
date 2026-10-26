import type { DropdownChoice, SomeCompanionActionInputField } from '@companion-module/base'
import type ModuleInstance from './main.js'
import { normaliseHotkeyId } from './cast-api.js'

export type ActionsSchema = {
	trigger_hotkey: {
		options: {
			hotkey: string
			mode: 'toggle' | 'start' | 'stop'
		}
	}
	stop_all_hotkeys: {
		options: Record<string, never>
	}
	refresh_hotkeys: {
		options: Record<string, never>
	}
}

export function hotkeyChoices(self: ModuleInstance): DropdownChoice<string>[] {
	const choices = self.hotkeys.map((h) => ({
		id: h.id,
		label: h.attachedItem ? `${h.id}: ${h.name} (${h.attachedItem.name})` : `${h.id}: ${h.name}`,
	}))
	// Offer H1 so the field is usable before Cast has been reached
	return choices.length ? choices : [{ id: 'H1', label: 'H1' }]
}

export function hotkeyOption(self: ModuleInstance): SomeCompanionActionInputField<'hotkey'> {
	const choices = hotkeyChoices(self)
	return {
		id: 'hotkey',
		type: 'dropdown',
		label: 'Hotkey',
		choices,
		default: choices[0].id,
		allowCustom: true,
		tooltip: 'Pick a hotkey from Cast, or type an ID such as H7',
	}
}

export function UpdateActions(self: ModuleInstance): void {
	self.setActionDefinitions({
		trigger_hotkey: {
			name: 'Trigger hotkey',
			description: 'Presses a hotkey in Cast. Pressing a playing hotkey stops it.',
			options: [
				hotkeyOption(self),
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Mode',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Toggle (same as pressing the key in Cast)' },
						{ id: 'start', label: 'Start only (skip if already playing)' },
						{ id: 'stop', label: 'Stop only (skip if not playing)' },
					],
					tooltip:
						'Start/Stop only rely on the playing state Companion knows about. ' +
						'Set up the Cast webhooks (see module help) so this stays accurate.',
				},
			],
			callback: async (event) => {
				const id = normaliseHotkeyId(event.options.hotkey)
				const state = self.getHotkeyState(id)
				if (event.options.mode === 'start' && state === 'playing') {
					self.log('debug', `${id} is already playing, not toggling`)
					return
				}
				if (event.options.mode === 'stop' && state !== 'playing') {
					self.log('debug', `${id} is not known to be playing, not toggling`)
					return
				}
				await self.triggerHotkey(id)
			},
		},
		stop_all_hotkeys: {
			name: 'Stop all playing hotkeys',
			description: 'Toggles off every hotkey Companion knows is playing',
			options: [],
			callback: async () => {
				const playing = self.playingHotkeys()
				if (!playing.length) self.log('info', 'Stop all: no hotkeys are known to be playing')
				for (const id of playing) await self.triggerHotkey(id)
			},
		},
		refresh_hotkeys: {
			name: 'Refresh hotkey list',
			description: 'Re-reads hotkey names and assignments from Cast',
			options: [],
			callback: async () => {
				await self.refreshHotkeys()
			},
		},
	})
}
