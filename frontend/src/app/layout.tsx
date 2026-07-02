import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/shared/Navbar";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import SessionProviderWrapper from "@/components/shared/SessionProviderWrapper";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import ServiceWorkerInit from "@/components/shared/ServiceWorkerInit";
import OfflineIndicator from "@/components/shared/OfflineIndicator";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sentinel AI — Community ActionGrid",
  description: "Real-time community disaster response powered by Gemini AI",
  keywords: ["disaster response", "emergency management", "community safety", "AI"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sentinel AI",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#ef4444" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
      </head>
      <body className={`${inter.className} min-h-screen bg-background`}>
        <SessionProviderWrapper>
          <RealtimeProvider>
            <ServiceWorkerInit />
            <OfflineIndicator />
            <Navbar />
            <main className="min-h-[calc(100vh-64px)]">
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
            <Toaster
              theme="dark"
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "hsl(222 47% 9%)",
                  border: "1px solid hsl(222 47% 16%)",
                  color: "hsl(213 31% 91%)",
                },
              }}
            />
          </RealtimeProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
