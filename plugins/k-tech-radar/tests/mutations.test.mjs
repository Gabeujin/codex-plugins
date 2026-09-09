import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  acquireMutationLease,
  releaseMutationLease
} from "../lib/mutations.mjs";

test("a live writer lease is never stolen merely because its mtime is old", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "k-tech-radar-live-lease-")
  );
  const first = await acquireMutationLease("catalog", {
    root,
    timeoutMs: 50,
    staleMs: 1
  });
  await assert.rejects(
    acquireMutationLease("catalog", {
      root,
      timeoutMs: 30,
      staleMs: 1
    }),
    (error) => error.code === "K_TECH_RADAR_BUSY"
  );
  await releaseMutationLease(first, "committed");
});

test("release refuses to overwrite a lease owned by another writer", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "k-tech-radar-owner-lease-")
  );
  const lease = await acquireMutationLease("dictionary", {
    root
  });
  const record = JSON.parse(
    await readFile(lease.leasePath, "utf8")
  );
  await writeFile(
    lease.leasePath,
    `${JSON.stringify(
      {
        ...record,
        ownerId: "other-owner"
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await assert.rejects(
    releaseMutationLease(lease, "committed"),
    (error) => error.code === "K_TECH_RADAR_LEASE_LOST"
  );
});
