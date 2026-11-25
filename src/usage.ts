// Antigravity quota for bb's Usage screen.
//
// `agy -p /usage --output-format json` prints the same quota summary as the
// TUI's /usage command. It sends no model prompt and uses agy's own sign-in,
// so this plugin never touches Google credentials. The run is hardened the way
// CodexBar does it: a private temp directory, auto-update off, browser
// launchers that fail instead of opening a sign-in page, and a bounded time
// and output size.

import { execFile } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

export type UsageWindow = {
  label: string;
  usedPercent: number;
  resetsAt: string | null;
};

export type UsageReport =
  | { status: "ok"; windows: UsageWindow[] }
  | { status: "not_installed" }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

interface Bucket {
  id?: unknown;
  name?: unknown;
  window?: unknown;
  remaining_fraction?: unknown;
  reset_time?: unknown;
  disabled?: unknown;
}

interface Group {
  name?: unknown;
  buckets?: unknown;
}

const WINDOW_LABELS: Record<string, string> = {
  "5h": "5-hour",
  weekly: "Weekly",
  daily: "Daily",
};

const SIGN_IN_PATTERN =
  /not (?:signed|logged) in|sign[ -]?in|log[ -]?in|unauthenticated|unauthori[sz]ed|oauth|credentials?/iu;

function groupLabel(name: string): string {
  // "Gemini Models" -> "Gemini", "Claude and GPT models" -> "Claude & GPT".
  return name
    .replace(/\s+models?$/iu, "")
    .replace(/\s+and\s+/iu, " & ")
    .trim();
}

function windowLabel(bucket: Bucket): string {
  const window = typeof bucket.window === "string" ? bucket.window : "";
  if (WINDOW_LABELS[window] !== undefined) return WINDOW_LABELS[window];
  return typeof bucket.name === "string" && bucket.name ? bucket.name : window || "Limit";
}

const NOT_JSON_MESSAGE = "agy printed a usage report that is not JSON.";

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  // agy emits the Unix epoch ("1970-01-01T00:00:00Z") for unused buckets with no reset window yet.
  if (Number.isNaN(time) || time <= 0) return null;
  return new Date(time).toISOString();
}

function cleanDetail(text: string): string | null {
  const line = text
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0 && !entry.startsWith("ERROR: logging before"));
  if (!line) return null;
  return line.length > 240 ? `${line.slice(0, 237)}...` : line;
}

/** Parse the JSON `agy -p /usage --output-format json` prints. */
export function parseUsageReport(stdout: string): UsageReport {
  let report: unknown;
  try {
    report = JSON.parse(stdout);
  } catch {
    return { status: "error", message: NOT_JSON_MESSAGE };
  }
  if (typeof report !== "object" || report === null) {
    return { status: "error", message: "agy printed an empty usage report." };
  }
  const record = report as {
    status?: unknown;
    response?: unknown;
    command?: { name?: unknown; data?: { groups?: unknown } };
  };
  const groups = record.command?.data?.groups;
  if (record.status !== "SUCCESS" || !Array.isArray(groups)) {
    const text = typeof record.response === "string" ? record.response.trim() : "";
    if (SIGN_IN_PATTERN.test(text)) return { status: "unauthenticated" };
    const detail = cleanDetail(text);
    return {
      status: "error",
      message: detail ?? `agy could not report usage (${typeof record.status === "string" ? record.status : "no status"}).`,
    };
  }

  const windows: UsageWindow[] = [];
  for (const group of groups as Group[]) {
    if (!Array.isArray(group?.buckets)) continue;
    const name = typeof group.name === "string" ? groupLabel(group.name) : "";
    for (const bucket of group.buckets as Bucket[]) {
      if (bucket?.disabled === true) continue;
      const remaining = bucket.remaining_fraction;
      if (typeof remaining !== "number" || !Number.isFinite(remaining)) continue;
      const used = (1 - Math.min(1, Math.max(0, remaining))) * 100;
      windows.push({
        label: name ? `${name} · ${windowLabel(bucket)}` : windowLabel(bucket),
        usedPercent: Math.round(used * 10) / 10,
        resetsAt: isoOrNull(bucket.reset_time),
      });
    }
  }
  if (windows.length === 0) {
    return { status: "error", message: "agy reported no quota buckets for this account." };
  }
  return { status: "ok", windows };
}

const RUN_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const CACHE_MS = 60_000;

/** Candidate agy executables: PATH first, then the installer's default. */
function agyCandidates(): string[] {
  return ["agy", path.join(homedir(), ".local", "bin", "agy")];
}

async function runOnce(command: string, cwd: string, env: NodeJS.ProcessEnv) {
  return await new Promise<{ code: number | null; stdout: string; stderr: string; missing: boolean }>(
    (resolve) => {
      execFile(
        command,
        ["-p", "/usage", "--output-format", "json"],
        { cwd, env, timeout: RUN_TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true },
        (error, stdout, stderr) => {
          const code = error && typeof (error as { code?: unknown }).code === "number"
            ? ((error as { code: number }).code)
            : error ? null : 0;
          const missing = (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
          resolve({ code, stdout: String(stdout ?? ""), stderr: String(stderr ?? ""), missing });
        },
      );
    },
  );
}

/** Run agy's usage report once, in a throwaway directory. */
export async function fetchUsage(baseEnv: NodeJS.ProcessEnv = process.env): Promise<UsageReport> {
  const dir = await mkdtemp(path.join(tmpdir(), "bb-antigravity-usage-"));
  try {
    // agy print mode may try to open a browser for Google sign-in when silent
    // sign-in fails. A quota probe must never do that, so the launchers it
    // looks for fail instead.
    const failing = "#!/bin/sh\nexit 1\n";
    for (const name of ["open", "xdg-open"]) {
      await writeFile(path.join(dir, name), failing);
      await chmod(path.join(dir, name), 0o755);
    }
    const env: NodeJS.ProcessEnv = {
      ...baseEnv,
      PATH: [dir, baseEnv.PATH ?? ""].filter(Boolean).join(path.delimiter),
      BROWSER: path.join(dir, "open"),
      // Lowercase "true" is required; agy ignores "1".
      AGY_CLI_DISABLE_AUTO_UPDATE: "true",
    };
    for (const command of agyCandidates()) {
      const result = await runOnce(command, dir, env);
      if (result.missing) continue;
      const stdout = result.stdout.trim();
      if (stdout.length > 0) {
        const parsed = parseUsageReport(stdout);
        if (
          parsed.status !== "error"
          || result.code === 0
          || parsed.message !== NOT_JSON_MESSAGE
        ) {
          return parsed;
        }
      }
      if (SIGN_IN_PATTERN.test(result.stderr)) return { status: "unauthenticated" };
      const detail = cleanDetail(result.stderr) ?? cleanDetail(stdout);
      return {
        status: "error",
        message: result.code === null
          ? "agy did not finish its usage report in time."
          : detail ?? `agy exited with code ${result.code} while reporting usage.`,
      };
    }
    return { status: "not_installed" };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

let cached: { at: number; report: Promise<UsageReport> } | null = null;

/** fetchUsage, shared by health and usage checks for a minute. */
export function cachedUsage(): Promise<UsageReport> {
  const now = Date.now();
  if (cached === null || now - cached.at > CACHE_MS) {
    const report = fetchUsage().catch(
      (error: unknown): UsageReport => ({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    cached = { at: now, report };
  }
  return cached.report;
}
