"use client";

import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// The viewer is EmbedPDF/PDFium (WASM) backed, so it must run client-only and
// is heavy enough to keep out of the main bundle until a PDF is actually opened.
const PDFViewer = dynamic(
  () =>
    import("@/components/extend-ui/pdf-viewer").then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center text-sm text-text-2">
        Loading viewer…
      </div>
    ),
  },
);

export function PdfViewerDialog({
  open,
  onOpenChange,
  src,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null;
  title: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90dvh] flex-col overflow-hidden p-0 sm:h-[88vh] sm:w-[min(calc(100vw-32px),1100px)]">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {src ? (
          <PDFViewer
            src={src}
            fileName={title}
            showUpload={false}
            className="h-full min-h-0 flex-1"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
