import type ModuleInstance from './main.js'

/**
 * Fixed variables plus four per hotkey, generated from Cast's hotkey list:
 *   <ID>_name, <ID>_item, <ID>_label, <ID>_state   (e.g. H1_name)
 */
export type VariablesSchema = {
	hotkey_count?: number
	playing_hotkeys?: string
	last_hotkey_id?: string
	last_hotkey_name?: string
	last_action?: string
	[perHotkey: string]: string | number | undefined
}

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const defs: Record<string, { name: string }> = {
		hotkey_count: { name: 'Number of hotkeys in Cast' },
		playing_hotkeys: { name: 'Hotkeys currently playing (comma separated)' },
		last_hotkey_id: { name: 'Last triggered hotkey ID' },
		last_hotkey_name: { name: 'Last triggered hotkey name' },
		last_action: { name: 'Last action reported by Cast (e.g. stopped)' },
	}
	for (const h of self.hotkeys) {
		defs[`${h.id}_name`] = { name: `${h.id} name` }
		defs[`${h.id}_item`] = { name: `${h.id} assigned item` }
		defs[`${h.id}_label`] = { name: `${h.id} button text` }
		defs[`${h.id}_state`] = { name: `${h.id} state (playing / stopped / unknown)` }
	}
	self.setVariableDefinitions(defs)
}
