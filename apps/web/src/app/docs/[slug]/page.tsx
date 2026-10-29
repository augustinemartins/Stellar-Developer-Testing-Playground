import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDoc, listDocs } from "@/lib/docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return listDocs()
    .filter((d) => d.slug !== "index")
    .map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const doc = getDoc((await params).slug);
  return doc ? { title: doc.title, description: doc.description } : {};
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const doc = getDoc((await params).slug);
  if (!doc) notFound();
  return <article className="prose-doc" dangerouslySetInnerHTML={{ __html: doc.html }} />;
}
