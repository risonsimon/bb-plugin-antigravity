import assert from "node:assert/strict";
import test from "node:test";

import { parseUsageReport } from "./usage.ts";

// Trimmed from a real `agy -p /usage --output-format json` run (agy 1.5.14).
const REPORT = {
  status: "SUCCESS",
  response: "Gemini Models\tWeekly Limit Remaining\t99%\t2026-11-29T05:50:08Z\n",
  command: {
    name: "usage",
    data: {
      groups: [
        {
          name: "Gemini Models",
          buckets: [
            { id: "gemini-weekly", name: "Weekly Limit Remaining", window: "weekly", remaining_fraction: 0.9908, reset_time: "2026-11-29T05:50:08Z" },
            { id: "gemini-5h", name: "Five Hour Limit Remaining", window: "5h", remaining_fraction: 0.9678, reset_time: "2026-11-22T10:50:08Z" },
          ],
        },
        {
          name: "Claude and GPT models",
          buckets: [
            { id: "3p-weekly", name: "Weekly Limit Remaining", window: "weekly", remaining_fraction: 1, reset_time: "2026-11-29T06:54:23Z" },
            { id: "3p-off", name: "Off", window: "5h", remaining_fraction: 0.5, disabled: true },
          ],
        },
        {
          name: "Gemini 4 Argon",
          buckets: [{ id: "gemini-argon-wtu-weekly", name: "Gemini 4 Argon Weekly Limit", window: "weekly", remaining_fraction: 1, reset_time: "2026-11-29T06:54:23Z" }],
        },
      ],
    },
  },
};

test("quota buckets become usage windows", () => {
  const report = parseUsageReport(JSON.stringify(REPORT));
  assert.equal(report.status, "ok");
  assert.deepEqual(report.status === "ok" ? report.windows : [], [
    { label: "Gemini · Weekly", usedPercent: 0.9, resetsAt: "2026-11-29T05:50:08.000Z" },
    { label: "Gemini · 5-hour", usedPercent: 3.2, resetsAt: "2026-11-22T10:50:08.000Z" },
    { label: "Claude & GPT · Weekly", usedPercent: 0, resetsAt: "2026-11-29T06:54:23.000Z" },
    { label: "Gemini 4 Argon · Weekly", usedPercent: 0, resetsAt: "2026-11-29T06:54:23.000Z" },
  ]);
});

test("a sign-in failure is unauthenticated, not an error", () => {
  const report = parseUsageReport(JSON.stringify({ status: "ERROR", response: "You are not logged into Antigravity." }));
  assert.deepEqual(report, { status: "unauthenticated" });
});

test("unparseable output is an error", () => {
  assert.equal(parseUsageReport("not json").status, "error");
  assert.equal(parseUsageReport(JSON.stringify({ status: "SUCCESS", command: { data: { groups: [] } } })).status, "error");
});
