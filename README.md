# bb-plugin-antigravity

Runs Google Antigravity in bb over its native ACP server (`agy acp`) and shows
its quota on bb's Usage screen.

- Provider: `antigravity`, using bb's published ACP bridge with an
  `antigravity` dialect for usage.
- Usage: `agy -p /usage --output-format json` (agy >= 1.1.11), run the way
  CodexBar does it: private temp directory, `AGY_CLI_DISABLE_AUTO_UPDATE=true`,
  failing `open`/`xdg-open` so no browser sign-in starts, 90 s and 1 MiB limits.

Requires `agy` installed and signed in on each machine.

```sh
npm install
npm test
bb plugin build .
bb plugin install .
```
