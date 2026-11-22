# bb-plugin-antigravity

Google Antigravity agent provider and usage plugin for [bb](https://getbb.app).

- Adds Google Antigravity as a bb agent provider over ACP (`agy acp`), with all Antigravity models in bb's model picker.
- Shows Antigravity quota on bb's Usage screen and in the sidebar usage panel.

## Requirements

- [bb](https://getbb.app) 0.50 or newer
- [Antigravity CLI](https://antigravity.google/docs/getting-started) (`agy`) 1.1.11 or newer, installed and signed in on each machine

Run `agy` in a terminal on a machine to sign in. If a machine is not signed in, it appears as unauthenticated on the Usage screen.

## Install

```sh
bb plugin install 'git:https://github.com/risonsimon/bb-plugin-antigravity@semver:*'
```

bb installs the latest release and offers each new release as an update.

## Compatibility

This plugin uses experimental bb plugin APIs, so a bb update may need a new plugin release.

## Development

```sh
npm install
npm test
bb plugin build .
bb plugin install .
```

## License

[MIT](LICENSE)
