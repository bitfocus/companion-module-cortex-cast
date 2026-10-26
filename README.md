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

To test without Cast, run the mock server and point the module at `127.0.0.1:9250`:

```sh
node test/mock-cast.mjs
```

### Cast protocol (from the Cast documentation, chapter 30 "Network Hotkeys")

| Request                                     | Effect                                             |
| ------------------------------------------- | -------------------------------------------------- |
| `POST http://<cast>:9250/hotkey/H1`         | Toggle hotkey H1. Replies with JSON incl. `action` |
| `POST http://<cast>:9250/hotkey/gethotkeys` | List hotkeys (`id`, `name`, `attachedItem`)        |

Cast can also send a GET to an "activated" and a "deactivated" URL per hotkey; the module receives these at `/instance/<label>/activate/<id>` and `/instance/<label>/deactivate/<id>`.
