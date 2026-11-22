// Registers Google Antigravity as a bb agent provider. Threads run on bb's
// ACP bridge (`agy acp`, see host.ts); the Usage screen reads agy's quota.
import type { BbPluginApi } from "@get-bb/plugin-sdk";

import { registerUsageSource } from "./src/usage-source";

const SKILL_ROOTS = {
  user: [
    { path: ".gemini/config/skills", recursive: true },
    { path: ".gemini/antigravity-cli/skills", recursive: true },
  ],
  project: [
    { path: ".agents/skills", recursive: true, ancestors: true },
    { path: ".gemini/skills", recursive: true, ancestors: true },
  ],
};

export default async function plugin(bb: BbPluginApi) {
  bb.providers.register({
    id: "antigravity",
    displayName: "Antigravity",
    family: "acp",
    icon: "./icons/antigravity.svg",
    strings: {
      signInHint: "Run `agy` on the machine to sign in to Antigravity.",
      expiredHint: "Your Antigravity sign-in expired. Run `agy` on the machine, then reload.",
      installUrl: "https://antigravity.google/docs/getting-started",
    },
    experimental_visibility: "installed",
    experimental_nativeSkillRoots: SKILL_ROOTS,
    experimental_bridgeOptions: {
      acpDialect: "antigravity",
      acpLaunchSpec: {
        displayName: "Antigravity",
        command: "agy",
        args: ["acp"],
        env: {},
        // Inserted after "acp": agy reads this as an acp flag.
        permissionCli: { full: ["--dangerously-skip-permissions"], insertAfterArgs: 1 },
        nativeSkillRoots: SKILL_ROOTS,
      },
    },
    models: { scope: "host" },
    maintenance: { health: true, usage: true, installation: false },
    capabilities: {
      supportsServiceTier: false,
      supportsNativeUserQuestion: false,
      supportsManualCompaction: false,
      supportsThreadArchive: false,
      supportsThreadRename: false,
      fork: "none",
      permissionModes: ["accept-edits", "full"],
      reasoningLevels: ["low", "medium", "high", "xhigh", "max"],
    },
    composerActions: [],
  });
  registerUsageSource(bb);
}
