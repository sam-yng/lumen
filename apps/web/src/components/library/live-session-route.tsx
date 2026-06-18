"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { LiveSessionCapture } from "@/components/transcripts/live-session-capture";

export function LiveSessionRoute({
  parentId,
  workspaceId,
}: {
  parentId: string | null;
  workspaceId: string;
}) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background">
      <header className="sticky top-0 z-20 flex min-h-[var(--topbar-h)] items-center gap-3 border-b border-[var(--border-soft)] bg-background/95 px-4 backdrop-blur lg:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md text-[13px] text-[var(--text-3)] transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to library
        </Link>
        <span className="truncate text-[13px] font-medium text-foreground">
          Live session
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
        <LiveSessionCapture parentId={parentId} workspaceId={workspaceId} />
      </div>
    </div>
  );
}
