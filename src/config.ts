import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

export const DEFAULT_PORT = 9250

export type ModuleConfig = {
	host: string
	port: number
	pollInterval: number
	timeout: number
	buttonText: ButtonTextMode
}

export type ButtonTextMode = 'item' | 'hotkey' | 'both'
export const DEFAULT_BUTTON_TEXT: ButtonTextMode = 'item'

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'info',
			label: 'About',
			width: 12,
			value:
				'Controls Cortex Cast through its Network Hotkeys interface (HTTP, port 9250). ' +
				'Allow inbound TCP 9250 through the Windows firewall on the Cast PC. ' +
				'For accurate playing state, add the webhook URLs from the module help to each hotkey in Cast.',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Cast PC IP address',
			width: 8,
			regex: Regex.HOSTNAME,
			default: '',
		},
		{
			type: 'number',
			id: 'port',
			label: 'Port',
			width: 4,
			min: 1,
			max: 65535,
			default: DEFAULT_PORT,
		},
		{
			type: 'number',
			id: 'pollInterval',
			label: 'Refresh hotkey list every (seconds, 0 = off)',
			tooltip: 'Keeps hotkey names up to date and detects when Cast goes offline',
			width: 6,
			min: 0,
			max: 3600,
			default: 10,
		},
		{
			type: 'number',
			id: 'timeout',
			label: 'Request timeout (ms)',
			width: 6,
			min: 250,
			max: 30000,
			default: 3000,
		},
		{
			type: 'dropdown',
			id: 'buttonText',
			label: 'Hotkey button text',
			tooltip: 'What preset buttons show. Updates live when you change hotkeys in Cast.',
			width: 6,
			default: DEFAULT_BUTTON_TEXT,
			choices: [
				{ id: 'item', label: 'Assigned content name (e.g. Cortex Adverts)' },
				{ id: 'hotkey', label: 'Hotkey name from Cast' },
				{ id: 'both', label: 'Hotkey name + content name' },
			],
		},
	]
}
