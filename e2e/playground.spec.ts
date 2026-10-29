import { expect, test, type Page } from "@playwright/test";

const SHOTS = process.env.E2E_SCREENSHOTS;

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

test("load a sample, simulate, inspect and replay a saved scenario", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await shot(page, "01-home");
  await page.getByRole("link", { name: "Open Counter" }).click();
  await expect(page.getByRole("heading", { name: "Counter", level: 1 })).toBeVisible();

  // Read-only call.
  await page.getByRole("navigation", { name: "Contract methods" }).getByRole("button", { name: /^get/ }).click();
  await page.getByRole("button", { name: "Simulate" }).click();
  await expect(page.getByText("Simulation succeeded.")).toBeVisible();
  await shot(page, "02-get");

  // Typed error, mapped to the spec's error enum.
  await page
    .getByRole("navigation", { name: "Contract methods" })
    .getByRole("button", { name: /^increment_by/ })
    .click();
  await page.getByLabel("step").fill("0");
  await page.getByRole("button", { name: "Simulate" }).click();
  await expect(page.getByText("CounterError::InvalidStep").first()).toBeVisible();

  // Client-side validation blocks out-of-range input.
  await page.getByLabel("step").fill("-1");
  await expect(page.getByText(/out of range for u32/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Simulate" })).toBeDisabled();

  // Successful write: events and resources.
  await page.getByLabel("step").fill("5");
  await page.getByRole("button", { name: "Simulate" }).click();
  await expect(page.getByText("Simulation succeeded.")).toBeVisible();
  await page.getByRole("tab", { name: /Events/ }).click();
  await expect(page.getByRole("button", { name: /contract Incremented/ })).toBeVisible();
  await page.getByRole("tab", { name: /Fees & resources/ }).click();
  await expect(page.getByRole("meter", { name: "CPU instructions" })).toBeVisible();
  await shot(page, "03-resources");

  // Save as a scenario and replay it.
  await page.getByRole("tab", { name: /Save & export/ }).click();
  await page.getByLabel("Name").fill("E2E increment");
  await page.getByRole("button", { name: "Save scenario" }).click();
  await page.getByRole("link", { name: "View saved scenarios" }).click();
  await expect(page.getByRole("heading", { name: /E2E increment/ })).toBeVisible();
  await page.getByRole("button", { name: "Replay" }).first().click();
  await expect(page.getByText("passing").first()).toBeVisible();
  await shot(page, "04-scenarios");

  expect(errors).toEqual([]);
});

test("JSON mode loads the self-hosted editor under the CSP", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Open Sample token" }).click();
  await page
    .getByRole("navigation", { name: "Contract methods" })
    .getByRole("button", { name: /^transfer_with_memo/ })
    .click();
  await page.getByRole("button", { name: "JSON" }).click();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await shot(page, "05-json-mode");
  expect(errors).toEqual([]);
});

test("rejects bad contract IDs and explains missing contracts", async ({ page }) => {
  await page.goto("/");
  const input = page.getByLabel("Contract ID");
  await input.fill("GABC");
  await input.blur();
  await expect(page.getByText(/Contract IDs start with C|account address/)).toBeVisible();
  // Valid checksum, but nothing deployed there.
  await page.goto("/workspace?contract=CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR");
  await expect(page.getByText("Contract not found")).toBeVisible();
});
