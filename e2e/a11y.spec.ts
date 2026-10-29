import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { expectAccessible, methods } from "./helpers";

const deployments = JSON.parse(readFileSync(new URL("../packages/contract-loader/src/fixtures/deployments.json", import.meta.url), "utf8"));
const COUNTER: string = deployments.contracts.counter.contractId;

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test("home, docs and scenarios have no WCAG A/AA violations", async ({ page }) => {
      for (const path of ["/", "/docs", "/docs/value-format", "/scenarios"]) {
        await page.goto(path);
        await expect(page.locator("main")).toBeVisible();
        await expectAccessible(page);
      }
    });

    test("workspace with results has no WCAG A/AA violations", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("link", { name: "Open Counter" }).click();
      await methods(page)
        .getByRole("button", { name: /^increment_by/ })
        .click();
      await page.getByRole("button", { name: "Increment by 5" }).click();
      await page.getByRole("button", { name: "Simulate" }).click();
      await expect(page.getByText("Simulation succeeded.")).toBeVisible();
      await expectAccessible(page);
      for (const tab of [/Fees & resources/, /Auth/, /Events/, /State/, /Save & export/]) {
        await page.getByRole("tab", { name: tab }).click();
        await expectAccessible(page);
      }
    });
  });
}

test("the main flow works with the keyboard alone", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.getByLabel("Contract ID").focus();
  await page.keyboard.type(COUNTER);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await methods(page).getByRole("button", { name: /^get/ }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText("Simulation succeeded.")).toBeVisible();
});
