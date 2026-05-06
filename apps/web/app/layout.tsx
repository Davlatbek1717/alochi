import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui";
import { DevServiceWorkerCleanup } from "@/components/DevServiceWorkerCleanup";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display font for the student panel (Duolingo-grade redesign).
// Cyrillic + Latin coverage so Uzbek/Russian/English all render in the
// same family. Wired through CSS variable so existing admin/teacher pages
// (which still use Geist) are unaffected.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "A'lochi",
  description: "A'lochi Learning Platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "A'lochi",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6d28d9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz">
      <body className={`${geistSans.variable} ${geistMono.variable} ${nunito.variable} antialiased`}>
        <DevServiceWorkerCleanup />
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
