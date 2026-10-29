import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppHeader } from "@/components/app-header";
import { SettingsProvider, THEME_BOOTSTRAP } from "@/lib/settings";

export const metadata: Metadata = {
  title: { default: "Stellar Developer Testing Playground", template: "%s · Stellar Playground" },
  description:
    "Simulate Soroban smart contract calls on Stellar testnet, inspect return values, fees, resources, authorization and events, and share reproducible test scenarios.",
  applicationName: "Stellar Developer Testing Playground",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1015" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
        >
          Skip to content
        </a>
        <SettingsProvider>
          <AppHeader />
          <main id="main" tabIndex={-1} className="focus:outline-none">
            {children}
          </main>
        </SettingsProvider>
      </body>
    </html>
  );
}
