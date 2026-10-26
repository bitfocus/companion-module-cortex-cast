import { combineRgb } from '@companion-module/base'
import type ModuleInstance from './main.js'
import { hotkeyChoices } from './actions.js'
import { normaliseHotkeyId } from './cast-api.js'

export type FeedbacksSchema = {
	hotkey_playing: {
		type: 'boolean'
		options: {
			hotkey: string
		}
	}
	any_hotkey_playing: {
		type: 'boolean'
		options: Record<string, never>
	}
}

export const PLAYING_STYLE = {
	bgcolor: combineRgb(204, 0, 0),
	color: combineRgb(255, 255, 255),
}

export function UpdateFeedbacks(self: ModuleInstance): void {
	const choices = hotkeyChoices(self)
	self.setFeedbackDefinitions({
		hotkey_playing: {
			name: 'Hotkey is playing',
			description: 'True while the hotkey is playing in Cast',
			type: 'boolean',
			defaultStyle: PLAYING_STYLE,
			options: [
				{
					id: 'hotkey',
					type: 'dropdown',
					label: 'Hotkey',
					choices,
					default: choices[0].id,
					allowCustom: true,
				},
			],
			callback: (feedback) => self.getHotkeyState(normaliseHotkeyId(feedback.options.hotkey)) === 'playing',
		},
		any_hotkey_playing: {
			name: 'Any hotkey is playing',
			description: 'True while at least one hotkey is playing in Cast',
			type: 'boolean',
			defaultStyle: PLAYING_STYLE,
			options: [],
			callback: () => self.playingHotkeys().length > 0,
		},
	})
}
