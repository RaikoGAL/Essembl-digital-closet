"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Today", icon: (a: boolean) => <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" strokeWidth={a ? 2.4 : 1.8} /> },
  { href: "/closet", label: "Closet", icon: (a: boolean) => <path d="M12 4l-6 4 6 3 6-3-6-4zM6 8v8l6 4 6-4V8" strokeWidth={a ? 2.4 : 1.8} /> },
  { href: "/studio", label: "Studio", icon: (a: boolean) => <path d="M4 20h16M6 20V9l6-5 6 5v11M10 20v-5h4v5" strokeWidth={a ? 2.4 : 1.8} /> },
  { href: "/rate", label: "Rate", icon: (a: boolean) => <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" strokeWidth={a ? 2.4 : 1.8} /> },
  { href: "/shop", label: "Shop", icon: (a: boolean) => <path d="M6 7h12l1 13H5L6 7zM9 7a3 3 0 0 1 6 0" strokeWidth={a ? 2.4 : 1.8} /> },
];

export default function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/closet/add") || path.startsWith("/onboarding")) return null;
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-ink/90 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto grid grid-cols-5">
        {tabs.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${active ? "text-accent" : "text-muted"}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                {t.icon(active)}
              </svg>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
