"use client";
import { useEffect } from "react";

async function hardRefresh() {
  // Clears cached app files only. Your closet (IndexedDB) is NOT touched.
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    await Promise.all((regs ?? []).map((r) => r.unregister()));
    const keys = await caches?.keys?.();
    await Promise.all((keys ?? []).map((k) => caches.delete(k)));
  } catch {
    /* ignore */
  }
  location.href = "/";
}

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    // A stale cached bundle after a redeploy shows up as a chunk load error: refresh once automatically.
    if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(error.message)) {
      if (!sessionStorage.getItem("chunk-reload")) {
        sessionStorage.setItem("chunk-reload", "1");
        hardRefresh();
      }
    }
  }, [error]);

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-card border border-line rounded-3xl p-6 text-center">
        <div className="text-4xl mb-3">🧵</div>
        <h2 className="text-lg font-semibold">Something came unstitched</h2>
        <p className="text-sm text-muted mt-1">Your closet is safe. Screenshot this and send it over if it keeps happening.</p>
        <pre className="mt-4 text-left text-xs bg-ink border border-line rounded-xl p-3 whitespace-pre-wrap break-words max-h-48 overflow-auto text-red-200">
          {error.message || String(error)}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          {typeof window !== "undefined" ? `\npage: ${location.pathname}` : ""}
        </pre>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={reset} className="rounded-full bg-accent text-ink py-2.5 text-sm font-medium">Try again</button>
          <button onClick={hardRefresh} className="rounded-full bg-line text-paper py-2.5 text-sm font-medium">Refresh app</button>
        </div>
      </div>
    </div>
  );
}
