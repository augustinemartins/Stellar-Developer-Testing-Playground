import "server-only";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Marked } from "marked";

export interface DocMeta {
  slug: string;
  title: string;
  description: string;
  order: number;
}

export interface Doc extends DocMeta {
  html: string;
}

/** The repository's docs/ folder is the single source for these pages (also readable on GitHub). */
function docsDir(): string {
  const candidates = [join(process.cwd(), "../../docs"), join(process.cwd(), "docs")];
  const found = candidates.find((d) => existsSync(join(d, "index.md")));
  if (!found) throw new Error(`docs/ folder not found (looked in ${candidates.join(", ")})`);
  return found;
}

function parseFrontmatter(src: string): { data: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!m) return { data: {}, body: src };
  const data: Record<string, string> = {};
  for (const line of m[1]!.split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { data, body: src.slice(m[0].length) };
}

function slugOf(file: string): string {
  return file.replace(/\.md$/, "") === "index" ? "index" : file.replace(/\.md$/, "");
}

/** Rewrites `other.md#x` links to `/docs/other#x`. */
function rewriteHref(href: string): string {
  if (/^[a-z]+:/i.test(href) || href.startsWith("/") || href.startsWith("#")) return href;
  const [path, hash] = href.split("#");
  if (!path?.endsWith(".md")) return href;
  const slug = path.replace(/^\.\//, "").replace(/\.md$/, "");
  return `/docs${slug === "index" ? "" : `/${slug}`}${hash ? `#${hash}` : ""}`;
}

const marked = new Marked({
  gfm: true,
  walkTokens(token) {
    if (token.type === "link") token.href = rewriteHref(token.href);
  },
});

export function listDocs(): DocMeta[] {
  const dir = docsDir();
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data } = parseFrontmatter(readFileSync(join(dir, f), "utf8"));
      return { slug: slugOf(f), title: data.title ?? f, description: data.description ?? "", order: Number(data.order ?? 99) };
    })
    .sort((a, b) => a.order - b.order);
}

export function getDoc(slug: string): Doc | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const file = join(docsDir(), `${slug}.md`);
  if (!existsSync(file)) return null;
  const { data, body } = parseFrontmatter(readFileSync(file, "utf8"));
  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    order: Number(data.order ?? 99),
    // Docs are first-party content from this repository, rendered at build time.
    html: marked.parse(body, { async: false }) as string,
  };
}
