# bb-plugin-antigravity

Google Antigravity agent provider and usage plugin for [bb](https://getbb.app).

- Adds Google Antigravity as a bb agent provider over ACP (`agy acp`), with all Antigravity models in bb's model picker.
- Shows Antigravity quota on bb's Usage screen and in the sidebar usage panel.

## Requirements

- [bb](https://getbb.app) 0.50 or newer
- [Antigravity CLI](https://antigravity.google/docs/getting-started) (`agy`) 1.5.16 or newer, installed and signed in on each machine (`agy acp` was added in 1.5.0; 1.5.16 includes ACP subagent prompt, stall, and turn-ending fixes)

Run `agy` in a terminal on a machine to sign in. If a machine is not signed in, it appears as unauthenticated on the Usage screen.

## Modes and permissions

bb shows two dropdowns for Antigravity threads:

- **Mode** (`Default`, `Accept edits`, `Auto`, `Plan`) — `agy acp`'s own agent mode.
- **Permission mode** (`Accept Edits`, `Full Access`) — bb's permission policy. **Full Access** adds `--dangerously-skip-permissions` and auto-approves ACP requests; choose **Accept Edits** when you want `agy`'s **Mode** (such as **Auto**) to control approval prompts.

## Install

```sh
bb plugin install https://github.com/risonsimon/bb-plugin-antigravity
```

bb tracks `main` directly and offers new commits as updates.

## Compatibility

This plugin uses experimental bb plugin APIs, so a bb update may require updating the plugin.

## Development

```sh
npm install
npm test
bb plugin build .
bb plugin install .
```

## License

[MIT](LICENSE)
