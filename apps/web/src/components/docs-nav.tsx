"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

export function DocsNav({ docs }: { docs: { slug: string; title: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Documentation" className="md:sticky md:top-20 md:self-start">
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {docs.map((d) => {
          const href = d.slug === "index" ? "/docs" : `/docs/${d.slug}`;
          const current = pathname === href;
          return (
            <li key={d.slug} className="shrink-0">
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cx("block rounded-md px-2.5 py-1.5 text-sm", current ? "bg-panel-2 font-medium" : "text-muted hover:text-fg")}
              >
                {d.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
