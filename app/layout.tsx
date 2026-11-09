import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { SWRegister } from "@/components/SWRegister";

export const metadata: Metadata = {
  title: "Digital Closet",
  description: "Your wardrobe, digitized. AI outfits from the clothes you already own.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Closet" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0f0f12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="max-w-md mx-auto min-h-dvh pb-24">{children}</div>
        <BottomNav />
        <SWRegister />
      </body>
    </html>
  );
}
