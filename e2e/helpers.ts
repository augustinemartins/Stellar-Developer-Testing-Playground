import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Collects console errors and uncaught exceptions; tests assert it stays empty. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

export async function shot(page: Page, name: string) {
  const dir = process.env.E2E_SCREENSHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

/** Fails on any WCAG 2.1 A/AA violation, listing each rule and the elements involved. */
export async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).join("\n  ")}`);
  expect(summary, "accessibility violations").toEqual([]);
}

export function methods(page: Page) {
  return page.getByRole("navigation", { name: "Contract methods" });
}
