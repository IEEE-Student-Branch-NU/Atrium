import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Analytics } from "@vercel/analytics/react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Atrium | IEEE SBNU Portal",
  description:
    "Internal management portal for IEEE Student Branch of Nirma University. Event creation, membership management, and approval workflows.",
  openGraph: {
    title: "Atrium | IEEE SBNU Portal",
    description: "Internal management portal for IEEE Student Branch of Nirma University.",
    url: "https://atrium.ieeesbnu.org",
    siteName: "Atrium",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Atrium | IEEE SBNU Portal",
    description: "Internal management portal for IEEE Student Branch of Nirma University.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
