"use client";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body style={{ background: "#0f0f12", color: "#f6f4ef", fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <h2 style={{ fontSize: 18 }}>Something came unstitched</h2>
        <p style={{ color: "#8a8a94", fontSize: 14 }}>Your closet is safe. Screenshot this message:</p>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, color: "#fecaca" }}>
          {error.message}
          {error.digest ? `\ndigest: ${error.digest}` : ""}
        </pre>
        <button
          onClick={async () => {
            try {
              const regs = await navigator.serviceWorker?.getRegistrations?.();
              await Promise.all((regs ?? []).map((r) => r.unregister()));
              const keys = await caches?.keys?.();
              await Promise.all((keys ?? []).map((k) => caches.delete(k)));
            } catch {}
            location.href = "/";
          }}
          style={{ marginTop: 16, padding: "10px 18px", borderRadius: 999, background: "#c8ff4d", color: "#0f0f12", border: 0, fontWeight: 600 }}
        >
          Refresh app
        </button>
      </body>
    </html>
  );
}
