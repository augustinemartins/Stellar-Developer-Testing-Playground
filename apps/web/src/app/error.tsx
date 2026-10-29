"use client";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="mx-auto max-w-xl space-y-3 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted">An unexpected error occurred in the playground. Your saved scenarios are not affected.</p>
      <pre className="overflow-auto rounded-md border border-border bg-panel-2 p-3 text-left font-mono text-xs">{error.message}</pre>
      <button type="button" onClick={reset} className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg">
        Try again
      </button>
    </div>
  );
}
