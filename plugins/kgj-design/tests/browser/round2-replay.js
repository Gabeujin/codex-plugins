async page => {
  const startedAt = new Date().toISOString();
  const checks = [];
  const negativeControls = [];
  const consoleEntries = [];
  const pageErrors = [];

  page.on("console", message => {
    consoleEntries.push({ type: message.type(), text: message.text() });
  });
  page.on("pageerror", error => {
    pageErrors.push(String(error && error.message ? error.message : error));
  });

  const baseUrl = await page.evaluate(() => `${location.protocol}//${location.host}/`);
  const asInteger = value => Number(String(value).replace(/[^0-9-]/g, ""));
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const runCheck = async (id, action) => {
    try {
      const observed = await action();
      checks.push({ id, status: "pass", observed });
    } catch (error) {
      checks.push({ id, status: "fail", error: String(error && error.message ? error.message : error) });
    }
  };
  const navigate = async (query = "", viewport = { width: 1280, height: 720 }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}${query}`, { waitUntil: "networkidle" });
  };
  const readPhenotype = async expected => {
    const total = asInteger(await page.locator("#primary-value").innerText());
    const values = await page.locator("#metric-bars .bar-item small").allTextContents();
    const series = values.map(asInteger);
    const summary = await page.locator("#chart-summary").innerText();
    const fixture = await page.locator(".primary-card").getAttribute("data-fixture-id");
    const label = await page.locator("#stage-kicker").innerText();
    const cta = await page.locator("#inspect-button").innerText();
    assert(total === expected.total, `${expected.name} total drifted: ${total}`);
    assert(series.reduce((sum, value) => sum + value, 0) === expected.total, `${expected.name} series no longer sums to total`);
    assert(series.length === 5 && series.every(value => summary.includes(new Intl.NumberFormat("ko-KR").format(value))), `${expected.name} accessible summary drifted from visible series`);
    assert(fixture === expected.fixture, `${expected.name} fixture drifted: ${fixture}`);
    assert(label.includes(expected.kicker), `${expected.name} stage label drifted`);
    assert(cta.startsWith(expected.name), `${expected.name} CTA drifted from the selected phenotype`);
    return { total, series, summary, fixture, cta };
  };
  const assertIsolatedTablists = async (phenotypeName, systemName) => {
    const state = await page.evaluate(() => [...document.querySelectorAll('[role="tablist"]')].map(root => ({
      label: root.getAttribute("aria-label"),
      selected: [...root.querySelectorAll('[role="tab"]')].filter(tab => tab.getAttribute("aria-selected") === "true").map(tab => tab.textContent.trim()),
      tabbable: [...root.querySelectorAll('[role="tab"]')].filter(tab => tab.tabIndex === 0).map(tab => tab.textContent.trim())
    })));
    assert(state.length === 2, `expected two tablists, found ${state.length}`);
    assert(state.every(item => item.selected.length === 1 && item.tabbable.length === 1), "tablist selection or roving tabindex escaped its root");
    assert(state[0].selected[0] === phenotypeName, `phenotype selection changed unexpectedly: ${state[0].selected[0]}`);
    assert(state[1].selected[0] === systemName, `system selection changed unexpectedly: ${state[1].selected[0]}`);
    return state;
  };

  await runCheck("desktop-primary-data-truth", async () => {
    await navigate();
    const expected = [
      { name: "Operations", total: 12482, fixture: "fixture.operations.signal", kicker: "OPERATIONS" },
      { name: "Research", total: 3816, fixture: "fixture.research.evidence", kicker: "EVIDENCE NOTE" },
      { name: "Spatial", total: 7604, fixture: "fixture.spatial.relations", kicker: "RELATION MAP" }
    ];
    const observations = [];
    for (const phenotype of expected) {
      await page.getByRole("tab", { name: phenotype.name, exact: true }).click();
      observations.push(await readPhenotype(phenotype));
    }
    await page.getByRole("tab", { name: "Operations", exact: true }).click();
    await page.screenshot({ path: "desktop-operations.png", fullPage: true });
    return observations;
  });

  await runCheck("isolated-keyboard-tablists", async () => {
    await navigate();
    await page.getByRole("tab", { name: "Operations", exact: true }).press("ArrowRight");
    const afterPhenotype = await assertIsolatedTablists("Research", "Project contract");
    await page.getByRole("tab", { name: "Project contract", exact: true }).press("End");
    const afterSystem = await assertIsolatedTablists("Research", "Pattern lifecycle");
    return { afterPhenotype, afterSystem };
  });

  await runCheck("dialog-focus-recovery", async () => {
    await navigate();
    await page.getByRole("tab", { name: "Spatial", exact: true }).click();
    const trigger = page.locator("#inspect-button");
    await trigger.click();
    assert(await page.locator("#evidence-panel").evaluate(dialog => dialog.open), "proof dialog did not open");
    const initialFocus = await page.evaluate(() => document.activeElement && document.activeElement.id);
    await page.keyboard.press("Tab");
    const forwardFocus = await page.evaluate(() => document.activeElement && document.activeElement.id);
    await page.keyboard.press("Shift+Tab");
    const reverseFocus = await page.evaluate(() => document.activeElement && document.activeElement.id);
    await page.keyboard.press("Escape");
    const returnedFocus = await page.evaluate(() => document.activeElement && document.activeElement.id);
    assert([initialFocus, forwardFocus, reverseFocus].every(value => value === "evidence-close"), "dialog focus escaped its only control");
    assert(returnedFocus === "inspect-button", `focus returned to ${returnedFocus || "nothing"}`);
    assert(await trigger.getAttribute("aria-expanded") === "false", "dialog trigger retained expanded state");
    return { initialFocus, forwardFocus, reverseFocus, returnedFocus };
  });

  await runCheck("mobile-390-navigation-reflow", async () => {
    await navigate("?fixture=long-ko", { width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    const title = await page.locator("#decision-title").innerText();
    assert(!overflow, "390px viewport has document-level horizontal overflow");
    assert(title.includes("부분 복구"), "long Korean fixture did not load");
    await page.locator("#nav-toggle").click();
    const navigationOpen = await page.locator("#nav-toggle").getAttribute("aria-expanded");
    const visibleTargets = await page.locator("button, a[href]").evaluateAll(elements => elements.filter(element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    }).map(element => {
      const rect = element.getBoundingClientRect();
      return { label: (element.textContent || element.getAttribute("aria-label") || "").trim(), width: rect.width, height: rect.height };
    }));
    const undersized = visibleTargets.filter(target => target.width < 44 || target.height < 44);
    assert(navigationOpen === "true", "mobile navigation did not open");
    assert(undersized.length === 0, `undersized targets: ${JSON.stringify(undersized)}`);
    await page.locator('#primary-nav a[href="#phenotype"]').click();
    assert(await page.locator("#nav-toggle").getAttribute("aria-expanded") === "false", "mobile navigation did not close after selection");
    await page.screenshot({ path: "mobile-390-long-ko.png", fullPage: true });
    return { overflow, navigationOpen, targetCount: visibleTargets.length, minimumWidth: Math.min(...visibleTargets.map(item => item.width)), minimumHeight: Math.min(...visibleTargets.map(item => item.height)) };
  });

  await runCheck("zoom-200-long-korean", async () => {
    await navigate("?fixture=long-ko&textScale=200", { width: 1280, height: 720 });
    const layout = await page.evaluate(() => {
      const columns = selector => getComputedStyle(document.querySelector(selector)).gridTemplateColumns;
      const decision = document.querySelector("#decision-title");
      return {
        textScale: document.documentElement.dataset.textScale,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        genomeColumns: columns(".genome-section"),
        stageColumns: columns(".stage-grid"),
        systemColumns: columns(".system-panel"),
        decisionOverflow: decision.scrollWidth > decision.clientWidth
      };
    });
    assert(layout.textScale === "200", "200 percent fixture did not activate");
    assert(!layout.overflow && !layout.decisionOverflow, "200 percent fixture overflowed");
    assert(!layout.genomeColumns.includes(" ") && !layout.stageColumns.includes(" ") && !layout.systemColumns.includes(" "), `multi-column layout survived zoom stress: ${JSON.stringify(layout)}`);
    await page.screenshot({ path: "zoom-200-long-ko.png", fullPage: true });
    return layout;
  });

  await runCheck("alternate-and-recovery-states", async () => {
    const states = [];
    for (const fixture of ["partial", "error"]) {
      await navigate(`?fixture=${fixture}`);
      const state = await page.locator("#decision-state").innerText();
      const verdict = await page.locator("#proof-verdict").innerText();
      const postCondition = await page.locator("#proof-postcondition").innerText();
      assert(state.includes(fixture === "partial" ? "HOLD" : "RECOVERY"), `${fixture} state is not fail-closed`);
      assert(verdict.startsWith("HOLD"), `${fixture} verdict claims readiness`);
      if (fixture === "error") assert(postCondition.includes("변경은 적용되지 않았고"), "error fixture lost unchanged-state language");
      states.push({ fixture, state, verdict, postCondition });
    }
    return states;
  });

  await runCheck("reduced-motion-performance-console", async () => {
    await navigate("?fixture=long-ko&motion=reduce", { width: 390, height: 844 });
    await page.waitForTimeout(100);
    const durations = await page.evaluate(() => {
      const sample = getComputedStyle(document.querySelector(".phenotype-stage"));
      return {
        diagnostic: window.__kgjDemoDiagnostics && window.__kgjDemoDiagnostics.reducedMotion,
        frameRequests: window.__kgjDemoDiagnostics && window.__kgjDemoDiagnostics.frameRequests,
        animationDuration: sample.animationDuration,
        transitionDuration: sample.transitionDuration
      };
    });
    const first = await page.screenshot({ path: "reduced-motion-a.png", fullPage: true });
    await page.waitForTimeout(450);
    const second = await page.screenshot({ path: "reduced-motion-b.png", fullPage: true });
    assert(durations.diagnostic === true, "reduced-motion diagnostic is false");
    assert(durations.frameRequests === 0, `reduced-motion requested ${durations.frameRequests} animation frames`);
    assert(first.equals(second), "reduced-motion screenshots changed after 450ms");
    return { ...durations, firstBytes: first.byteLength, secondBytes: second.byteLength, byteStable: true };
  });

  await runCheck("contrast-and-semantic-representation", async () => {
    await navigate();
    const audit = await page.evaluate(() => {
      const parse = input => {
        const values = input.match(/[\d.]+/g).map(Number);
        return values.slice(0, 3);
      };
      const luminance = rgb => {
        const values = rgb.map(value => value / 255).map(value => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
        return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
      };
      const ratio = (foreground, background) => {
        const a = luminance(parse(foreground));
        const b = luminance(parse(background));
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      };
      const card = document.querySelector(".decision-card");
      const body = document.querySelector("#decision-copy");
      const cardStyle = getComputedStyle(card);
      const bodyStyle = getComputedStyle(body);
      return {
        contrast: ratio(bodyStyle.color, cardStyle.backgroundColor),
        main: document.querySelectorAll("main").length,
        navigation: document.querySelectorAll("nav[aria-label]").length,
        tablists: document.querySelectorAll('[role="tablist"]').length,
        tabpanels: document.querySelectorAll('[role="tabpanel"]').length,
        statuses: document.querySelectorAll('[role="status"]').length,
        chartSummary: document.querySelector("#chart-summary").textContent.trim(),
        dialogLabel: document.querySelector("#evidence-panel").getAttribute("aria-labelledby")
      };
    });
    assert(audit.contrast >= 4.5, `decision contrast is ${audit.contrast}`);
    assert(audit.main === 1 && audit.navigation >= 1 && audit.tablists === 2 && audit.tabpanels === 2 && audit.statuses >= 2, `semantic structure drifted: ${JSON.stringify(audit)}`);
    assert(audit.chartSummary.length > 20 && audit.dialogLabel === "evidence-title", "accessible chart or dialog labeling drifted");
    return audit;
  });

  await runCheck("skip-link-target", async () => {
    await navigate();
    const skip = page.locator('a[href="#main"]').first();
    await skip.press("Enter");
    const result = await page.evaluate(() => ({ hash: location.hash, activeTag: document.activeElement && document.activeElement.tagName, activeId: document.activeElement && document.activeElement.id }));
    assert(result.hash === "#main" && result.activeTag === "MAIN" && result.activeId === "main", `skip target failed: ${JSON.stringify(result)}`);
    return result;
  });

  const runNegativeControl = async (id, mutate, verify) => {
    await navigate();
    try {
      await mutate();
      await verify();
      negativeControls.push({ id, status: "fail", detected: false, error: "mutant survived" });
    } catch (error) {
      negativeControls.push({ id, status: "pass", detected: true, observedFailure: String(error && error.message ? error.message : error) });
    }
  };

  await runNegativeControl(
    "mutant-global-tab-selector",
    async () => page.evaluate(() => {
      const all = [...document.querySelectorAll('[role="tab"]')];
      all.forEach(tab => { tab.setAttribute("aria-selected", "false"); tab.tabIndex = -1; });
      all[0].setAttribute("aria-selected", "true"); all[0].tabIndex = 0;
    }),
    async () => assertIsolatedTablists("Operations", "Project contract")
  );

  await runNegativeControl(
    "mutant-stale-phenotype-data",
    async () => {
      await page.getByRole("tab", { name: "Research", exact: true }).click();
      await page.locator("#primary-value").evaluate(element => { element.textContent = "12,482"; });
    },
    async () => readPhenotype({ name: "Research", total: 3816, fixture: "fixture.research.evidence" })
  );

  await runNegativeControl(
    "mutant-dialog-expanded-state",
    async () => {
      const trigger = page.locator("#inspect-button");
      await trigger.click();
      await trigger.evaluate(element => element.setAttribute("aria-expanded", "false"));
    },
    async () => {
      const trigger = page.locator("#inspect-button");
      assert(await page.locator("#evidence-panel").evaluate(dialog => dialog.open), "proof dialog did not open");
      assert(await trigger.getAttribute("aria-expanded") === "true", "open dialog is exposed as collapsed");
    }
  );

  await runNegativeControl(
    "mutant-mobile-navigation-state",
    async () => {
      await navigate("", { width: 390, height: 844 });
      const trigger = page.locator("#nav-toggle");
      await trigger.click();
      await trigger.evaluate(element => element.setAttribute("aria-expanded", "false"));
    },
    async () => assert(await page.locator("#nav-toggle").getAttribute("aria-expanded") === "true", "open mobile navigation is exposed as collapsed")
  );

  await runNegativeControl(
    "mutant-reduced-motion-frame-request",
    async () => {
      await navigate("?motion=reduce", { width: 390, height: 844 });
      await page.evaluate(() => { Object.defineProperty(window.__kgjDemoDiagnostics, "frameRequests", { value: 1, configurable: true }); });
    },
    async () => {
      const diagnostic = await page.evaluate(() => ({ ...window.__kgjDemoDiagnostics }));
      assert(diagnostic.reducedMotion === true && diagnostic.frameRequests === 0, `reduced-motion scheduled frames: ${JSON.stringify(diagnostic)}`);
    }
  );

  await runNegativeControl(
    "mutant-zoom-overflow",
    async () => {
      await navigate("?fixture=long-ko&textScale=200", { width: 1280, height: 720 });
      await page.addStyleTag({ content: "body{min-width:2000px!important}" });
    },
    async () => assert(!await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), "200 percent fixture has document-level overflow")
  );

  const browser = page.context().browser();
  const warningsAndErrors = consoleEntries.filter(entry => entry.type === "warning" || entry.type === "warn" || entry.type === "error");
  const status = checks.every(check => check.status === "pass") && negativeControls.every(control => control.status === "pass") && warningsAndErrors.length === 0 && pageErrors.length === 0 ? "pass" : "fail";
  return {
    schemaVersion: "1.0",
    id: "kgj-round2-browser-replay",
    startedAt,
    completedAt: new Date().toISOString(),
    status,
    environment: {
      browser: browser ? browser.browserType().name() : "unknown",
      browserVersion: browser ? browser.version() : "unknown",
      userAgent: await page.evaluate(() => navigator.userAgent),
      localOnly: true
    },
    checks,
    negativeControls,
    consoleEntries,
    pageErrors,
    limitations: [
      "Automated Chromium replay is separate from the Codex in-app browser receipt.",
      "The 200 percent case is a deterministic CSS zoom stress fixture, not every browser chrome zoom implementation.",
      "Semantic DOM assertions and snapshots do not replace a physical screen-reader session."
    ]
  };
}
