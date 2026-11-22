// Host artifact: bb's published ACP bridge runs `agy acp`, and the
// "antigravity" dialect adds sign-in status and quota from agy's own
// usage report (see src/usage.ts).
import { experimental_registerAcpDialect } from "@get-bb/plugin-sdk/provider-bridge/acp";

import { cachedUsage } from "./src/usage";

export { experimental_acpProviderBridge as experimental_providerBridge } from "@get-bb/plugin-sdk/provider-bridge/acp";

experimental_registerAcpDialect({
  id: "antigravity",
  maintenance: {
    loginCommand: "agy",
    installer: () => ({
      command: "/bin/sh",
      args: ["-c", "curl -fsSL https://antigravity.google/cli/install.sh | bash"],
      displayCommand: "curl -fsSL https://antigravity.google/cli/install.sh | bash",
    }),
    // Health runs often and must stay fast; the only sign-in check agy offers
    // is the ~9 s usage report, so health reports ready once agy is installed
    // and a missing sign-in surfaces on the Usage screen instead.
    async readAccount() {
      return { email: null };
    },
    async readUsage() {
      const report = await cachedUsage();
      if (report.status === "ok") {
        return {
          supported: true,
          usage: { status: "ok", accountEmail: null, planLabel: null, windows: report.windows },
        };
      }
      if (report.status === "error") {
        return {
          supported: true,
          usage: { status: "error", message: report.message, accountEmail: null, planLabel: null },
        };
      }
      return { supported: true, usage: { status: report.status } };
    },
  },
});
