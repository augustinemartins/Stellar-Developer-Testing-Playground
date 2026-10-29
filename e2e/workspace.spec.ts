import { expect, test } from "@playwright/test";
import { methods, trackErrors } from "./helpers";

test("network selector validates custom RPCs and switches networks", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /Testnet network/ });
  await expect(trigger).toHaveAccessibleName(/protocol \d+/);

  await trigger.click();
  await page.getByLabel("RPC URL").fill("http://example.com");
  await page.getByRole("button", { name: "Use custom RPC" }).click();
  await expect(page.getByText("Use https:// (plain http is only allowed for localhost).")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("RPC URL")).toBeHidden();

  // Reopening starts the form from the current network again.
  await trigger.click();
  await expect(page.getByLabel("RPC URL")).toHaveValue("https://soroban-testnet.stellar.org");
  await page.getByRole("radio", { name: /Futurenet/ }).click();
  await expect(page.getByRole("button", { name: /Futurenet network/ })).toBeVisible();

  // Samples only exist on testnet, so opening one switches back.
  await page.getByRole("link", { name: "Open Counter" }).click();
  await expect(page.getByRole("button", { name: /Testnet network/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("JSON mode keeps what you type and stays in sync with the form", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Open Counter" }).click();
  await methods(page)
    .getByRole("button", { name: /^increment_by/ })
    .click();
  await page.getByRole("button", { name: "JSON" }).click();
  const editor = page.locator(".monaco-editor").first();
  await expect(editor).toBeVisible();

  // Replace the text the way an edit from the user would (typing would trigger auto-closing brackets).
  await page.evaluate(() => {
    type Editor = {
      getModel(): { getFullModelRange(): unknown };
      executeEdits(src: string, edits: { range: unknown; text: string }[]): void;
    };
    const ed = (window as unknown as { monaco: { editor: { getEditors(): Editor[] } } }).monaco.editor.getEditors()[0]!;
    ed.executeEdits("e2e", [{ range: ed.getModel().getFullModelRange(), text: '{"step": 7}' }]);
  });
  // Valid input must not be reformatted under the cursor.
  await expect(editor.locator(".view-lines")).toHaveText(/^\{"step":\s7\}$/);

  await page.getByRole("button", { name: "Form" }).click();
  await expect(page.getByLabel("step")).toHaveValue("7");

  await page.getByLabel("step").fill("9");
  await page.getByRole("button", { name: "JSON" }).click();
  await expect(editor.locator(".view-lines")).toContainText('"step": 9');
});

test("suggested calls, keyboard simulate and run history", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Open Sample token" }).click();
  await methods(page)
    .getByRole("button", { name: /^metadata/ })
    .click();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText("Simulation succeeded.")).toBeVisible();
  await expect(page.getByText("Playground Token").first()).toBeVisible();

  await methods(page)
    .getByRole("button", { name: /^transfer_with_memo/ })
    .click();
  const suggestion = page.getByRole("button", { name: /Transfer with memo/ });
  await suggestion.click();
  await page.getByRole("button", { name: "Simulate" }).click();
  await page.getByRole("tab", { name: /Auth/ }).click();
  await expect(page.getByText(/transfer_with_memo/).first()).toBeVisible();

  const history = page.getByRole("combobox").filter({ hasText: /Latest/ });
  await expect(history.locator("option")).toHaveCount(2);
});
