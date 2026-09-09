import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  cp,
  mkdtemp,
  readFile,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { pluginRoot } from "../lib/paths.mjs";

const execFileAsync = promisify(execFile);

test("verify rejects duplicate, missing, or out-of-order Dictionary commit positions", async () => {
  const dataRoot = await mkdtemp(
    join(tmpdir(), "k-tech-radar-verify-ledger-")
  );
  await cp(join(pluginRoot, "data"), dataRoot, {
    recursive: true
  });
  const dictionaryPath = join(
    dataRoot,
    "dictionary.json"
  );
  const dictionary = JSON.parse(
    await readFile(dictionaryPath, "utf8")
  );
  const keys = Object.keys(dictionary.idempotency);
  assert.ok(keys.length >= 2);
  dictionary.idempotency[
    keys[1]
  ].committedRevision =
    dictionary.idempotency[keys[0]].committedRevision;
  await writeFile(
    dictionaryPath,
    `${JSON.stringify(dictionary, null, 2)}\n`,
    "utf8"
  );

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [join(pluginRoot, "scripts", "verify.mjs")],
      {
        cwd: pluginRoot,
        env: {
          ...process.env,
          K_TECH_RADAR_DATA_DIR: dataRoot
        }
      }
    ),
    (error) => {
      const result = JSON.parse(error.stdout);
      assert.equal(result.status, "failed");
      assert.ok(
        result.failures.some((failure) =>
          /global commit ledger/.test(failure)
        )
      );
      return true;
    }
  );
});
