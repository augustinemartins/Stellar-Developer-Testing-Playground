import type { ReactNode } from "react";
import { DocsNav } from "@/components/docs-nav";
import { listDocs } from "@/lib/docs";

export default function DocsLayout({ children }: { children: ReactNode }) {
  const docs = listDocs();
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[220px_1fr]">
      <DocsNav docs={docs.map(({ slug, title }) => ({ slug, title }))} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
