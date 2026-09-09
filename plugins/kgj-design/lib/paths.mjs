import os from "node:os";
import path from "node:path";

export function dataRoot(env = process.env, platform = process.platform) {
  if (env.KGJ_DESIGN_DATA_DIR) {
    return path.resolve(env.KGJ_DESIGN_DATA_DIR);
  }
  if (platform === "win32") {
    const base = env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.join(base, "KGJ Design", "v1");
  }
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "KGJ Design", "v1");
  }
  return path.join(env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"), "kgj-design", "v1");
}

export function runtimePaths(root = dataRoot()) {
  return {
    root,
    projection: path.join(root, "dictionary.json"),
    ledger: path.join(root, "dictionary-ledger.jsonl"),
    events: path.join(root, "events"),
    idempotency: path.join(root, "idempotency.json"),
    runs: path.join(root, "design-runs.jsonl"),
    snapshot: path.join(root, "snapshot.json"),
    lease: path.join(root, "mutation.lease"),
    leaseArchive: path.join(root, "leases"),
    versions: path.join(root, "versions")
  };
}
