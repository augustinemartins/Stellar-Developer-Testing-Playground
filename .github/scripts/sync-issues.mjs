/**
 * Creates GitHub issues from the Markdown files in .github/issues/.
 *
 * Each file has front matter with `title` and comma-separated `labels`, then the issue body.
 * Issues are matched by title (open or closed), so running this again never creates duplicates
 * and never edits issues that already exist. Missing labels are created.
 *
 *   GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo node .github/scripts/sync-issues.mjs
 *   DRY_RUN=1 node .github/scripts/sync-issues.mjs   # parse and print only
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = new URL("../issues/", import.meta.url).pathname;
const DRY_RUN = !!process.env.DRY_RUN;
const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GITHUB_TOKEN;

const LABEL_COLORS = {
  "complexity: trivial": ["c2e0c6", "Small, well-defined task (Wave: Trivial)"],
  "complexity: medium": ["fbca04", "A few hours to a couple of days (Wave: Medium)"],
  "complexity: high": ["d93f0b", "Larger feature or cross-cutting change (Wave: High)"],
  "good first issue": ["7057ff", "Good for newcomers"],
  accessibility: ["0e8a16", "Accessibility improvements"],
  security: ["b60205", "Security-sensitive change"],
};
const DEFAULT_COLOR = ["ededed", ""];

function parse(file) {
  const text = readFileSync(join(DIR, file), "utf8");
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m) throw new Error(`${file}: missing front matter`);
  const meta = Object.fromEntries(
    m[1].split("\n").map((line) => {
      const i = line.indexOf(":");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
  );
  if (!meta.title) throw new Error(`${file}: missing title`);
  const labels = (meta.labels ?? "")
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
  return { file, title: meta.title, labels, body: m[2].trim() };
}

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok && res.status !== 404) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 404 ? null : res.json();
}

async function existingTitles() {
  const titles = new Set();
  for (let page = 1; ; page++) {
    const batch = await gh(`/issues?state=all&per_page=100&page=${page}`);
    for (const i of batch) if (!i.pull_request) titles.add(i.title);
    if (batch.length < 100) return titles;
  }
}

const issues = readdirSync(DIR)
  .filter((f) => f.endsWith(".md"))
  .sort()
  .map(parse);

if (DRY_RUN) {
  for (const i of issues) console.log(`${i.file}: "${i.title}" [${i.labels.join(" | ")}] (${i.body.length} chars)`);
  console.log(`${issues.length} issues parsed (dry run, nothing created).`);
  process.exit(0);
}
if (!REPO || !TOKEN) throw new Error("GITHUB_REPOSITORY and GITHUB_TOKEN are required (or set DRY_RUN=1).");

for (const name of new Set(issues.flatMap((i) => i.labels))) {
  if (await gh(`/labels/${encodeURIComponent(name)}`)) continue;
  const [color, description] = LABEL_COLORS[name] ?? DEFAULT_COLOR;
  await gh("/labels", { method: "POST", body: JSON.stringify({ name, color, description }) });
  console.log(`created label "${name}"`);
}

const have = await existingTitles();
let created = 0;
for (const i of issues) {
  if (have.has(i.title)) {
    console.log(`exists: ${i.title}`);
    continue;
  }
  const issue = await gh("/issues", { method: "POST", body: JSON.stringify({ title: i.title, body: i.body, labels: i.labels }) });
  console.log(`created #${issue.number}: ${i.title}`);
  created++;
  await new Promise((r) => setTimeout(r, 1500)); // stay well under GitHub's content-creation rate limit
}
console.log(`${created} created, ${issues.length - created} already existed.`);
