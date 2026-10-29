import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDoc } from "@/lib/docs";

export const metadata: Metadata = { title: "Documentation" };

export default function DocsIndexPage() {
  const doc = getDoc("index");
  if (!doc) notFound();
  return <article className="prose-doc" dangerouslySetInnerHTML={{ __html: doc.html }} />;
}
