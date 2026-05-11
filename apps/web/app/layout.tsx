import type { Metadata, Viewport } from "next";
import { Manrope, Fraunces, JetBrains_Mono, Nunito } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui";
import { DevServiceWorkerCleanup } from "@/components/DevServiceWorkerCleanup";
import { StaleAssetReloader } from "@/components/StaleAssetReloader";

// Body font — Manrope: humanist geometric sans with excellent Cyrillic
// coverage. Reads beautifully at small sizes in both Uzbek and Russian.
const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Display font — Fraunces: a contemporary variable serif with optical
// sizes. Feels editorial and trustworthy. Used for hero headlines,
// marketing landings, and certificate titles. Loaded as variable font
// (no weight prop) so we can sweep optical-size + softness in CSS.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap",
});

// Code font — JetBrains Mono replaces Geist Mono. Reads better in
// inline tokens, error messages, and keyboard hints.
const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

// Student panel keeps Nunito — the rounded, friendly tone is
// intentional for the kids' experience.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "A'lochi — O'zbekistondagi zamonaviy ta'lim SaaS platformasi",
    template: "%s · A'lochi",
  },
  description:
    "3–7 sinf o'quvchilari uchun zamonaviy ta'lim platformasi: AI suhbat, kamera nazorati va ota-ona uchun Telegram hisobotlar.",
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
  themeColor: "#1e1b4b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz">
      <body
        className={`${manrope.variable} ${fraunces.variable} ${mono.variable} ${nunito.variable} antialiased`}
      >
        <DevServiceWorkerCleanup />
        <StaleAssetReloader />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
