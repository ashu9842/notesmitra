import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// Vite resolves this to the correct asset URL in both dev and production.
// Using ?url avoids Vite adding ?import to the path which breaks the worker.
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

interface ProtectedPdfCanvasProps {
  /** A blob: URL (not a direct server URL) for the PDF data. */
  blobUrl: string;
  className?: string;
}

/**
 * Renders a PDF as a series of HTML <canvas> elements instead of an <iframe>.
 *
 * Why this matters for copy-protection:
 *  - No browser PDF toolbar → no built-in "Download" button.
 *  - Blob URL contains raw PDF bytes; with an <iframe> the user can paste the
 *    blob URL in a new tab and get the PDF. With canvas rendering the blob URL
 *    is consumed by PDF.js internally and never set as an iframe src.
 *  - Right-clicking a canvas gives "Save image as" for a single page JPEG,
 *    not the full PDF document.
 *  - CSS user-select:none + onContextMenu:preventDefault add another layer.
 */
export function ProtectedPdfCanvas({ blobUrl, className }: ProtectedPdfCanvasProps) {
  // canvasRef is the inner div that only the imperative render loop writes to.
  // React never renders children into it, so container.innerHTML = "" is safe.
  const canvasRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!blobUrl) return;

    let cancelled = false;
    setLoading(true);
    setRenderError(null);

    const render = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(blobUrl);
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        const container = canvasRef.current;
        if (!container) return;

        // Safe: React has no children in this div
        container.innerHTML = "";

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) break;

          const page = await pdf.getPage(pageNum);
          const scale = 1.5;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.cssText = "width:100%;display:block;user-select:none;";
          canvas.draggable = false;

          const wrapper = document.createElement("div");
          wrapper.style.cssText =
            "position:relative;margin-bottom:8px;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;background:#fff;";

          const label = document.createElement("div");
          label.textContent = `Page ${pageNum} of ${pdf.numPages}`;
          label.style.cssText =
            "position:absolute;bottom:6px;right:10px;font-size:11px;color:#9ca3af;background:rgba(255,255,255,0.7);padding:2px 6px;border-radius:3px;pointer-events:none;user-select:none;z-index:2;";

          wrapper.appendChild(canvas);
          wrapper.appendChild(label);
          container.appendChild(wrapper);

          const ctx = canvas.getContext("2d")!;
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        }
      } catch (err: any) {
        if (!cancelled) setRenderError(err?.message || "Failed to render PDF");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    render();
    return () => { cancelled = true; };
  }, [blobUrl]);

  const blockEvent = (e: React.SyntheticEvent) => e.preventDefault();

  return (
    <div
      className={className}
      onContextMenu={blockEvent}
      onDragStart={blockEvent}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        msUserSelect: "none" as any,
        overflowY: "auto",
      }}
    >
      {loading && (
        <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
          <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3" />
          Rendering pages…
        </div>
      )}
      {renderError && (
        <div className="text-center text-red-600 py-8 text-sm">{renderError}</div>
      )}
      {/* React never renders into this div — imperative canvas appends only */}
      <div ref={canvasRef} />
    </div>
  );
}
