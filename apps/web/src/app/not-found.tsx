import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-3 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-muted">That page does not exist.</p>
      <Link href="/" className="text-accent underline">
        Back to the playground
      </Link>
    </div>
  );
}
