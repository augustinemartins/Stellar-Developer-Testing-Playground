"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FlaskConical, Library, Moon, Sun, SunMoon } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { NetworkSelector } from "./network-selector";
import { cx } from "./ui";

const NAV = [
  { href: "/", label: "Playground", icon: FlaskConical, match: (p: string) => p === "/" || p.startsWith("/workspace") },
  { href: "/scenarios", label: "Scenarios", icon: Library, match: (p: string) => p.startsWith("/scenarios") },
  { href: "/docs", label: "Docs", icon: BookOpen, match: (p: string) => p.startsWith("/docs") },
];

const THEMES = ["system", "light", "dark"] as const;

export function AppHeader() {
  const pathname = usePathname() ?? "/";
  const { theme, setTheme } = useSettings();
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : SunMoon;
  const nextTheme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-panel/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="grid size-7 place-items-center rounded-md bg-accent text-accent-fg">
            ✦
          </span>
          <span className="sr-only sm:not-sr-only">Stellar Playground</span>
        </Link>
        <nav aria-label="Main" className="ml-2 flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon, match }) => {
            const current = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={current ? "page" : undefined}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm",
                  current ? "bg-panel-2 font-medium text-fg" : "text-muted hover:text-fg",
                )}
              >
                <Icon aria-hidden className="size-4" />
                <span className="sr-only md:not-sr-only">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <NetworkSelector />
          <button
            type="button"
            onClick={() => setTheme(nextTheme)}
            className="grid size-9 place-items-center rounded-md text-muted hover:bg-panel-2 hover:text-fg"
            aria-label={`Theme: ${theme}. Switch to ${nextTheme}.`}
            title={`Theme: ${theme}`}
          >
            <ThemeIcon aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
