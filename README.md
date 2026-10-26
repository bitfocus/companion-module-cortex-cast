# companion-module-cortex-cast

[Bitfocus Companion](https://bitfocus.io/companion) module for **Cortex Cast** LED playout software. It triggers Cast's Network Hotkeys over HTTP (port 9250), lists hotkeys live from Cast, and tracks playing state through Cast's hotkey webhooks.

See [HELP.md](./companion/HELP.md) for setup and usage, and [LICENSE](./LICENSE).

## Development

```sh
yarn          # install dependencies (Node 26, Yarn 4)
yarn dev      # compile in watch mode
yarn build    # compile once
yarn lint
yarn package  # build a .tgz to load into Companion
```

To test without Cast, run the fake Cast server (needs Node.js 22+) and point the module at it:

```sh
node test/mock-cast.mjs                       # same PC as Companion -> Cast IP 127.0.0.1
node test/mock-cast.mjs --lan                 # different PC -> use the IP it prints
node test/mock-cast.mjs --webhooks http://127.0.0.1:8000/instance/cortex-cast   # also send webhooks
```

It logs every request, and you can type a hotkey ID (e.g. `H2`) and press Enter to toggle it as if pressed on the Cast PC.

### Cast protocol (from the Cast documentation, chapter 30 "Network Hotkeys")

| Request                                     | Effect                                             |
| ------------------------------------------- | -------------------------------------------------- |
| `POST http://<cast>:9250/hotkey/H1`         | Toggle hotkey H1. Replies with JSON incl. `action` |
| `POST http://<cast>:9250/hotkey/gethotkeys` | List hotkeys (`id`, `name`, `attachedItem`)        |

Cast can also send a GET to an "activated" and a "deactivated" URL per hotkey; the module receives these at `/instance/<label>/activate/<id>` and `/instance/<label>/deactivate/<id>`.
