import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { methods, trackErrors } from "./helpers";

const example = readFileSync(new URL("../examples/scenarios/counter-get.json", import.meta.url), "utf8");

test("import pasted JSON, replay, export and delete", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/scenarios");
  await expect(page.getByText("No saved scenarios yet")).toBeVisible();

  await page.getByRole("button", { name: "Paste JSON" }).click();
  await page.getByLabel(/Scenario JSON/).fill("{ not json");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByText("That JSON is not a valid scenario.")).toBeVisible();

  await page.getByLabel(/Scenario JSON/).fill(example);
  await page.getByRole("button", { name: "Import", exact: true }).click();
  const card = page.getByRole("article", { name: /Counter: Read the count/ });
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "Replay" }).click();
  await expect(card.getByText("passing")).toBeVisible();

  const [collection] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export all" }).click()]);
  expect(collection.suggestedFilename()).toBe("scenarios.collection.json");
  const exported = JSON.parse(readFileSync((await collection.path())!, "utf8"));
  expect(exported.scenarios.map((s: { id: string }) => s.id)).toEqual(["counter-get"]);

  const [vitest] = await Promise.all([
    page.waitForEvent("download"),
    card.getByRole("button", { name: "Download Counter: Read the count as a Vitest test" }).click(),
  ]);
  expect(readFileSync((await vitest.path())!, "utf8")).toContain("simulateTransaction");

  // Saved scenarios survive a reload (localStorage).
  await page.reload();
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "Delete Counter: Read the count" }).click();
  await card.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("No saved scenarios yet")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a share link opens in a fresh browser and replays", async ({ page, browser }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Open Counter" }).click();
  await methods(page).getByRole("button", { name: /^get/ }).click();
  await page.getByRole("button", { name: "Simulate" }).click();
  await expect(page.getByText("Simulation succeeded.")).toBeVisible();
  await page.getByRole("tab", { name: /Save & export/ }).click();
  await page.getByRole("button", { name: "Create share link" }).click();
  const url = await page.getByLabel("Share link").inputValue();
  expect(url).toMatch(/\/scenarios#scenario=/);

  // A separate context has empty storage, like someone else opening the link.
  const other = await browser.newContext();
  const friend = await other.newPage();
  const errors = trackErrors(friend);
  await friend.goto(url);
  await expect(friend.getByRole("heading", { name: /Shared scenario:/ })).toBeVisible();
  await friend.getByRole("button", { name: "Import and replay" }).click();
  await expect(friend.getByText("passing").first()).toBeVisible();
  expect(new URL(friend.url()).hash).toBe("");
  expect(errors).toEqual([]);
  await other.close();
});

test("a tampered share link is rejected", async ({ page }) => {
  await page.goto("/scenarios#scenario=not-a-real-token");
  await expect(page.getByText(/Unrecognised share link|shared scenario is invalid/)).toBeVisible();
  await expect(page.getByText("No saved scenarios yet")).toBeVisible();
});
