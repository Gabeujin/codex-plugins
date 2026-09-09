import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  isManagedInstallPath,
  resolveDefaultDataRoot
} from "../lib/paths.mjs";

test("managed plugin caches use a durable Windows user data path", () => {
  const managedRoot =
    "C:\\Users\\Test\\.codex\\plugins\\cache\\personal\\k-tech-radar\\0.3.0";
  assert.equal(isManagedInstallPath(managedRoot), true);
  assert.equal(
    resolveDefaultDataRoot({
      root: managedRoot,
      platform: "win32",
      userHome: "C:\\Users\\Test",
      environment: {
        LOCALAPPDATA: "C:\\Users\\Test\\AppData\\Local"
      }
    }),
    join(
      "C:\\Users\\Test\\AppData\\Local",
      "KTechRadar",
      "data"
    )
  );
});

test("development sources keep bundled data unless explicitly overridden", () => {
  assert.equal(
    resolveDefaultDataRoot({
      root: "D:\\work\\k-tech-radar",
      platform: "win32",
      userHome: "C:\\Users\\Test",
      environment: {}
    }),
    join("D:\\work\\k-tech-radar", "data")
  );
  assert.equal(
    resolveDefaultDataRoot({
      root: "D:\\work\\k-tech-radar",
      platform: "win32",
      userHome: "C:\\Users\\Test",
      environment: {
        K_TECH_RADAR_DATA_DIR: "D:\\state\\radar"
      }
    }),
    "D:\\state\\radar"
  );
});
