import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceRoute } from "@/components/workspace/workspace-view";
import { Spinner } from "@/components/ui";

export const metadata: Metadata = { title: "Contract workspace" };

export default function WorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner label="Loading workspace…" />
        </div>
      }
    >
      <WorkspaceRoute />
    </Suspense>
  );
}
