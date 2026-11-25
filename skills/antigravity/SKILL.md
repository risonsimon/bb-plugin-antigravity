---
name: antigravity
description: Use when running, troubleshooting, or checking quota for the Antigravity (agy) provider in bb.
---

# Antigravity provider

The `antigravity` plugin registers provider `antigravity`. Threads run Google's
native ACP server, `agy acp`, through bb's ACP bridge. `agy` must be installed
(default `~/.local/bin/agy`) and signed in on the machine that runs the thread.

- Requires `agy` 1.5.16 or newer (`agy acp` was added in 1.5.0; 1.5.16 fixes ACP subagent prompts, stalls, and turn endings).
- Sign in: run `agy` in a terminal on that machine.
- Full access adds `--dangerously-skip-permissions` to `agy acp` and auto-approves ACP requests. Use bb's Accept Edits permission mode when you want `agy`'s own Mode option (`Default`, `Accept edits`, `Auto`, `Plan`) to control approvals.
- Models, thinking levels, and agent modes come from `agy acp` itself.

## Usage

Usage runs `agy -p /usage --output-format json` on the selected machine, in a
temporary directory, with auto-update off and browser sign-in blocked. It sends
no model prompt. Each quota bucket becomes a window such as `Gemini · 5-hour`
or `Claude & GPT · Weekly`.

```sh
bb settings usage --machine <id-or-name> --json
```

Health reports ready whenever `agy` is installed; a missing sign-in shows as
`unauthenticated` on the Usage screen, because the usage report is the only
sign-in check agy offers and it takes several seconds.
