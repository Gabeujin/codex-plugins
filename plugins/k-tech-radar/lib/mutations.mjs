import {
  mkdir,
  open,
  readFile,
  rename,
  stat,
  writeFile
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { join } from "node:path";

import { dataRoot } from "./paths.mjs";

const queues = new Map();

export function withMutationQueue(name, task) {
  const key = String(name);
  const previous = queues.get(key) ?? Promise.resolve();
  const current = previous
    .catch(() => undefined)
    .then(task);
  queues.set(key, current);
  current.finally(() => {
    if (queues.get(key) === current) {
      queues.delete(key);
    }
  }).catch(() => undefined);
  return current;
}

export function pendingMutationQueues() {
  return queues.size;
}

function delay(milliseconds) {
  return new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );
}

function safeMutationName(value) {
  const name = String(value);
  if (!/^[a-z0-9-]{1,80}$/u.test(name)) {
    throw new Error(`Invalid mutation lock name: ${name}`);
  }
  return name;
}

async function moveStaleLease(
  leasePath,
  receiptRoot,
  name
) {
  const stalePath = join(
    receiptRoot,
    `${name}-${Date.now()}-stale-${randomUUID()}.json`
  );
  try {
    await rename(leasePath, stalePath);
    return true;
  } catch (error) {
    if (["ENOENT", "EACCES", "EPERM"].includes(error?.code)) {
      return false;
    }
    throw error;
  }
}

function processIsAlive(processId) {
  if (!Number.isInteger(processId) || processId <= 0) {
    return null;
  }
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") {
      return false;
    }
    return true;
  }
}

async function staleLeaseIsRecoverable(leasePath) {
  let record;
  try {
    record = JSON.parse(await readFile(leasePath, "utf8"));
  } catch {
    return false;
  }
  if (record.host !== hostname()) {
    return false;
  }
  return processIsAlive(Number(record.processId)) === false;
}

export async function acquireMutationLease(
  name,
  {
    root = dataRoot,
    timeoutMs = 10_000,
    staleMs = 120_000
  } = {}
) {
  const lockName = safeMutationName(name);
  const lockRoot = join(root, ".mutation-locks");
  const receiptRoot = join(lockRoot, "receipts");
  const leasePath = join(lockRoot, `${lockName}.lock`);
  await mkdir(receiptRoot, { recursive: true });
  const startedAt = Date.now();
  const ownerId = `${process.pid}:${randomUUID()}`;

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const handle = await open(leasePath, "wx");
      const acquiredAt = new Date().toISOString();
      const record = {
        schemaVersion: 1,
        name: lockName,
        ownerId,
        processId: process.pid,
        host: hostname(),
        acquiredAt,
        status: "active"
      };
      await handle.writeFile(
        `${JSON.stringify(record, null, 2)}\n`,
        "utf8"
      );
      await handle.close();
      return {
        leasePath,
        receiptRoot,
        record
      };
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }
      try {
        const leaseStat = await stat(leasePath);
        if (
          Date.now() - leaseStat.mtimeMs > staleMs &&
          (await staleLeaseIsRecoverable(leasePath))
        ) {
          await moveStaleLease(
            leasePath,
            receiptRoot,
            lockName
          );
          continue;
        }
      } catch (statError) {
        if (statError?.code !== "ENOENT") {
          throw statError;
        }
      }
      await delay(40 + Math.floor(Math.random() * 40));
    }
  }
  const error = new Error(
    `Mutation ${lockName} is busy; retry after the active writer finishes`
  );
  error.code = "K_TECH_RADAR_BUSY";
  throw error;
}

export async function releaseMutationLease(
  lease,
  status,
  detail = null
) {
  const current = JSON.parse(
    await readFile(lease.leasePath, "utf8")
  );
  if (
    current.ownerId !== lease.record.ownerId ||
    current.processId !== lease.record.processId ||
    current.host !== lease.record.host
  ) {
    const error = new Error(
      `Mutation lease ownership changed before release: ${lease.record.name}`
    );
    error.code = "K_TECH_RADAR_LEASE_LOST";
    throw error;
  }
  const finishedAt = new Date().toISOString();
  const receipt = {
    ...lease.record,
    finishedAt,
    status,
    detail
  };
  await writeFile(
    lease.leasePath,
    `${JSON.stringify(receipt, null, 2)}\n`,
    "utf8"
  );
  const receiptPath = join(
    lease.receiptRoot,
    `${lease.record.name}-${finishedAt.replaceAll(/[:.]/gu, "")}-${status}-${randomUUID()}.json`
  );
  await rename(lease.leasePath, receiptPath);
  return receiptPath;
}

export function withMutationLease(
  name,
  task,
  options = {}
) {
  return withMutationQueue(name, async () => {
    const lease = await acquireMutationLease(name, options);
    try {
      const value = await task({
        ownerId: lease.record.ownerId,
        acquiredAt: lease.record.acquiredAt
      });
      await releaseMutationLease(lease, "committed");
      return value;
    } catch (error) {
      try {
        await releaseMutationLease(
          lease,
          "failed",
          error?.code ?? error?.message ?? String(error)
        );
      } catch {
        // A stale lease is recoverable on the next bounded acquisition.
      }
      throw error;
    }
  });
}
