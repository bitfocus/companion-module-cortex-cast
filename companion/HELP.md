## Cortex Cast

Controls [Cortex Cast](https://cortextech.io/solutions/playout-software/cast-playout-software) LED playout software through its **Network Hotkeys** HTTP interface. Anything you can bind to a hotkey in Cast (a broadcast, a template or a whole playlist) can be fired from a Companion button.

### Setting up Cast

1. On the Cast PC, find its IP address on the show network.
2. Allow inbound **TCP port 9250** through the Windows firewall on that PC (an inbound rule is better than turning the firewall off).
3. Create your hotkeys in Cast's hotkey panel as normal (H1, H2, ...). Content, interrupt/overlay type and post-playback action are all set in Cast.

### Configuration

| Field               | Description                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------- |
| Cast PC IP address  | IP of the machine running Cast                                                              |
| Port                | Network Hotkeys port. Cast uses **9250**                                                    |
| Refresh hotkey list | How often to re-read hotkey names from Cast and check it's online. 0 turns it off           |
| Request timeout     | How long to wait for Cast to answer                                                         |
| Hotkey button text  | What hotkey buttons show: the **assigned content name** (default), the hotkey name, or both |

When connected, the module reads every hotkey from Cast. Dropdowns, presets and variables are built from that list and update automatically when you add or rename hotkeys in Cast.

### Actions

- **Trigger hotkey**: presses a hotkey, exactly like pressing its key in Cast. Pressing a playing hotkey stops it. Modes:
  - _Toggle_: always press.
  - _Start only_: press only if the hotkey isn't already playing (protects against a double-press stopping a goal graphic).
  - _Stop only_: press only if the hotkey is playing.
- **Stop all playing hotkeys**: presses every hotkey Companion knows is playing.
- **Refresh hotkey list**: re-reads hotkeys from Cast now.

The hotkey field also accepts a typed ID (e.g. `H12`) or a variable/expression.

### Feedbacks

- **Hotkey is playing**: red while the chosen hotkey plays.
- **Any hotkey is playing**: red while any hotkey plays.

### Accurate playing state: set up the webhooks

Cast only reports what happened when Companion presses a hotkey. To also know when a hotkey **ends by itself** (post-playback action) or is **pressed from the keyboard, MIDI or Cast's own panel**, point each hotkey's webhooks at Companion. In Cast, open **Edit Hotkey → WebHooks** and enter:

- **Hotkey Activated URL:** `http://<companion-ip>:8000/instance/<connection-label>/activate/H1`
- **Hotkey Deactivated URL:** `http://<companion-ip>:8000/instance/<connection-label>/deactivate/H1`

Replace `<companion-ip>` with the Companion machine's IP, `8000` with Companion's web port if you changed it, `<connection-label>` with this connection's label (e.g. `cortex-cast`), and `H1` with the hotkey's ID. Without webhooks, feedback and the _Start only_ / _Stop only_ modes rely on presses made from Companion.

### Variables

| Variable           | Description                                             |
| ------------------ | ------------------------------------------------------- |
| `hotkey_count`     | Number of hotkeys in Cast                               |
| `playing_hotkeys`  | Hotkeys currently playing, e.g. `H1, H4`                |
| `last_hotkey_id`   | Last hotkey triggered from Companion                    |
| `last_hotkey_name` | Its name                                                |
| `last_action`      | Action Cast reported for that press                     |
| `H1_name`          | Name of hotkey H1 (one set per hotkey)                  |
| `H1_item`          | Item bound to H1                                        |
| `H1_label`         | Text shown on H1's button (per the button text setting) |
| `H1_state`         | `playing`, `stopped` or `unknown`                       |

### Presets

The module builds one button per hotkey from Cast's hotkey list (red while playing, grey if nothing is bound), plus **Stop all** and **Refresh hotkeys**. Find them under **Presets → Cortex: Cast** and drag them onto your pages. Companion doesn't let modules place buttons on pages themselves.

By default each button shows the name of the content bound to the hotkey, tidied up: `Media: Goal_Celebration.mp4` becomes **Goal Celebration**. Change this with **Hotkey button text** in the connection settings. Button text is live, so when you rebind or rename content in Cast, buttons you've already placed update within the refresh interval.

### Troubleshooting

- **Connection failure / timed out**: check the IP, that Cast is running, and the firewall rule for TCP 9250. From another PC, `curl -X POST http://<cast-ip>:9250/hotkey/gethotkeys -d ""` should return JSON.
- **Hotkeys missing**: press _Refresh hotkeys_, or check the hotkey exists in Cast's panel.
- **Feedback out of step**: set up the webhooks above.
