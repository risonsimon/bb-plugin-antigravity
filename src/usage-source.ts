// Usage source for bb's sidebar usage panel (the builtin provider-usage
// plugin). That panel does not read providers directly: it discovers plugins
// that serve the `provider-usage.v1` RPC pair and shows their resources. This
// publishes one resource per connected machine that has agy installed, and
// reads quota through bb's own usage endpoint (which runs host.ts readUsage).
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";

const PROVIDER_ID = "antigravity";
const CACHE_MS = 60_000;

const plan = z.object({ id: z.string().min(1), multiplier: z.number().int().positive().nullable() });
const accountFields = {
  plan: plan.nullable().default(null),
  accountEmail: z.string().nullable(),
  planLabel: z.string().nullable(),
};
const usageWindow = z.object({
  kind: z.enum(["five-hour", "daily", "weekly", "custom"]).default("custom"),
  id: z.string().min(1),
  label: z.string().min(1),
  usedPercent: z.number().nonnegative(),
  resetsAt: z.string().nullable(),
  model: z.string().nullable(),
  cost: z.object({ usedUsdCents: z.number().nonnegative(), limitUsdCents: z.number().positive() }).nullable(),
});
const usage = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), ...accountFields, windows: z.array(usageWindow) }),
  z.object({ status: z.literal("not_installed"), ...accountFields }),
  z.object({ status: z.literal("unauthenticated"), ...accountFields }),
  z.object({ status: z.literal("expired"), ...accountFields }),
  z.object({ status: z.literal("error"), ...accountFields, message: z.string() }),
]);
const accountKey = z.string().min(1).nullable().default(null);
const resource = z.object({
  accountKey,
  id: z.string().min(1),
  providerId: z.string().min(1),
  label: z.string().min(1),
  scope: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("shared") }),
    z.object({ kind: z.literal("host"), hostId: z.string().min(1), hostName: z.string().min(1) }),
  ]),
});
const resourceUsage = z.object({
  accountKey,
  observedAt: z.number().int().nonnegative().nullable(),
  usage,
});
type ResourceUsage = z.infer<typeof resourceUsage>;

const LIST = "provider-usage.v1.listResources";
const GET = "provider-usage.v1.getResource";

const contract = defineRpcContract({
  [LIST]: {
    input: z.object({}),
    output: z.object({ label: z.string().min(1).optional(), resources: z.array(resource) }),
  },
  [GET]: {
    input: z.object({ resourceId: z.string().min(1), refresh: z.boolean() }),
    output: resourceUsage,
  },
});

/**
 * Compact sidebar label. The panel only shortens its own standard window
 * names and would drop the model group, so windows are sent as "custom" with
 * short labels: "Gemini · 5-hour" -> "Gemini 5h", "Gemini 4 Argon · Weekly"
 * -> "Argon 7d".
 */
function compactLabel(label: string): string {
  const [group = "", window = ""] = label.split(" · ");
  const short = { "5-hour": "5h", Weekly: "7d", Daily: "1d" }[window] ?? window;
  const name = group.replace(/^Gemini \d+(?:\.\d+)? /u, "");
  return [name, short].filter(Boolean).join(" ") || label;
}

export function registerUsageSource(bb: BbPluginApi) {
  const last = new Map<string, ResourceUsage>();
  const inflight = new Map<string, Promise<ResourceUsage>>();

  async function hostHasProvider(hostId: string) {
    const providers = await bb.sdk.providers.list({ hostId, capability: "usage" });
    return providers.some((provider) => provider.id === PROVIDER_ID);
  }

  async function load(hostId: string, refresh: boolean): Promise<ResourceUsage> {
    const previous = last.get(hostId);
    const unavailable = (message: string): ResourceUsage => ({
      accountKey: null,
      observedAt: previous?.observedAt ?? null,
      usage: { status: "error", plan: null, accountEmail: null, planLabel: null, message },
    });
    const host = await bb.sdk.hosts.get({ hostId });
    if (host.status === "disconnected") return unavailable("Machine is disconnected.");
    if (!(await hostHasProvider(hostId))) throw new Error("Usage resource no longer exists.");
    if (!refresh && previous?.usage.status === "ok" && previous.observedAt !== null
      && Date.now() - previous.observedAt < CACHE_MS) {
      return previous;
    }
    try {
      const limits = await bb.sdk.system.usageLimits({ hostId, providerId: PROVIDER_ID, refresh });
      const result = (limits as Record<string, unknown>)[PROVIDER_ID] as
        | { status: string; windows?: { label: string; usedPercent: number; resetsAt: string | null }[]; message?: string }
        | undefined;
      if (!result) return unavailable("Antigravity returned no usage information.");
      const base = { plan: null, accountEmail: null, planLabel: null };
      let parsed: ResourceUsage;
      if (result.status === "ok") {
        parsed = resourceUsage.parse({
          accountKey: null,
          observedAt: Date.now(),
          usage: {
            ...base,
            status: "ok",
            windows: (result.windows ?? []).map((window, index) => ({
              kind: "custom",
              id: `${index}:${window.label}`,
              label: compactLabel(window.label),
              usedPercent: window.usedPercent,
              resetsAt: window.resetsAt ?? null,
              model: null,
              cost: null,
            })),
          },
        });
      } else if (result.status === "error") {
        return unavailable(result.message ?? "Usage could not be collected.");
      } else {
        parsed = resourceUsage.parse({
          accountKey: null,
          observedAt: previous?.observedAt ?? null,
          usage: { ...base, status: result.status },
        });
      }
      last.set(hostId, parsed);
      return parsed;
    } catch {
      return unavailable("Usage could not be collected from this machine.");
    }
  }

  function collect(hostId: string, refresh: boolean) {
    const running = inflight.get(hostId);
    if (running && !refresh) return running;
    const promise = load(hostId, refresh).finally(() => inflight.delete(hostId));
    inflight.set(hostId, promise);
    return promise;
  }

  bb.rpc.register(
    contract,
    {
      async [LIST]() {
        const hosts = await bb.sdk.hosts.list();
        const resources = (
          await Promise.all(
            hosts.map(async (host) => {
              const present = await hostHasProvider(host.id).catch(() => false);
              return present
                ? [{
                  id: host.id,
                  accountKey: null,
                  providerId: PROVIDER_ID,
                  label: "Antigravity",
                  scope: { kind: "host" as const, hostId: host.id, hostName: host.name },
                }]
                : [];
            }),
          )
        ).flat();
        return { resources };
      },
      async [GET]({ resourceId, refresh }) {
        return await collect(resourceId, refresh);
      },
    },
    {
      experimental_discoverable: true,
      experimental_description: "Host-local Antigravity (agy) quota. Inventory reads metadata only.",
    },
  );
}
