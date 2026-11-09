"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export function useBlobUrl(blob?: Blob | null): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return setUrl(undefined);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

export function PageHeader({ title, subtitle, right, back }: { title: string; subtitle?: string; right?: ReactNode; back?: string }) {
  return (
    <header className="sticky top-0 z-20 bg-ink/85 backdrop-blur border-b border-line px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
      <div className="flex items-center gap-3">
        {back && (
          <Link href={back} className="w-9 h-9 -ml-1 flex items-center justify-center rounded-full hover:bg-card" aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted truncate">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  loading,
  className = "",
  type = "button",
  size = "md",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "outline";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: "button" | "submit";
  size?: "sm" | "md" | "lg";
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-5 py-2.5 text-sm", lg: "px-6 py-3.5 text-base w-full" }[size];
  const variants = {
    primary: "bg-accent text-ink hover:bg-accent-dark",
    ghost: "bg-card text-paper hover:bg-line",
    outline: "border border-line text-paper hover:bg-card",
    danger: "bg-red-500/15 text-red-300 hover:bg-red-500/25",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={`${base} ${sizes} ${variants} ${className}`}>
      {loading && <Spinner size={16} />}
      {children}
    </button>
  );
}

export function Spinner({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`bg-card rounded-2xl border border-line ${onClick ? "cursor-pointer active:scale-[0.99] transition" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function Chip({ children, active, onClick, className = "" }: { children: ReactNode; active?: boolean; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition ${
        active ? "bg-paper text-ink border-paper" : "bg-transparent text-paper/80 border-line hover:border-muted"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="text-center px-6 py-14">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {body && <p className="text-muted text-sm mt-1 max-w-xs mx-auto">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="mx-4 my-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm flex items-start gap-3">
      <span>⚠️</span>
      <span className="flex-1">{error}</span>
      {onRetry && (
        <button onClick={onRetry} className="underline">
          Retry
        </button>
      )}
    </div>
  );
}

export function ScoreRing({ score, size = 96, label }: { score: number; size?: number; label?: string }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 85 ? "#c8ff4d" : pct >= 70 ? "#8be9fd" : pct >= 50 ? "#ffd166" : "#ff6b6b";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#26262d" strokeWidth="8" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-semibold" style={{ fontSize: size * 0.3 }}>{Math.round(pct)}</span>
        {label && <span className="text-[10px] text-muted uppercase tracking-wide">{label}</span>}
      </div>
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-ink border border-line rounded-t-3xl sm:rounded-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <div className="mx-auto w-10 h-1 rounded-full bg-line mb-4 sm:hidden" />
        {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm text-muted mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full bg-card border border-line rounded-xl px-3.5 py-2.5 text-paper placeholder:text-muted/60 outline-none focus:border-accent/60";

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-7 rounded-full transition ${checked ? "bg-accent" : "bg-line"}`}
    >
      <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-ink transition ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="px-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
