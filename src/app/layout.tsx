import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Analytics } from "@vercel/analytics/react";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import Script from "next/script";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://atrium.ieeesbnu.org"),
  title: {
    default: "Atrium – IEEE Student Branch Nirma University Portal",
    template: "%s | Atrium – IEEE SBNU",
  },
  description:
    "Atrium is the official portal of IEEE Student Branch, Nirma University (IEEE SBNU). Manage events, memberships, approvals, and chapter activities for IEEE Nirma.",
  keywords: [
    "Atrium",
    "Atrium Nirma",
    "Atrium IEEE SBNU",
    "IEEE SBNU",
    "IEEE Student Branch Nirma University",
    "IEEE Nirma University",
    "IEEE Nirma",
    "Nirma University IEEE",
    "IEEE SBNU Portal",
    "IEEE Student Branch Portal",
    "Nirma University",
    "IEEE events Nirma",
    "IEEE membership Nirma",
  ],
  authors: [{ name: "IEEE Student Branch, Nirma University", url: "https://ieeesbnu.org" }],
  creator: "IEEE Student Branch, Nirma University",
  publisher: "IEEE Student Branch, Nirma University",
  applicationName: "Atrium",
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  alternates: {
    canonical: "https://atrium.ieeesbnu.org",
  },
  icons: {
    icon: [
      { url: "/icon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Atrium – IEEE Student Branch Nirma University Portal",
    description:
      "Official portal of IEEE Student Branch, Nirma University. Event management, membership approvals, and chapter activities.",
    url: "https://atrium.ieeesbnu.org",
    siteName: "Atrium – IEEE SBNU",
    images: [
      {
        url: "/logo-v1.png",
        width: 512,
        height: 512,
        alt: "Atrium – IEEE Student Branch Nirma University Logo",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Atrium – IEEE Student Branch Nirma University Portal",
    description:
      "Official portal of IEEE Student Branch, Nirma University. Manage events, memberships, and approvals.",
    images: ["/logo-v1.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "education",
};

/** JSON-LD structured data for Organization – helps all search engines */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "IEEE Student Branch, Nirma University",
  alternateName: ["IEEE SBNU", "Atrium", "Atrium IEEE SBNU", "IEEE Nirma"],
  url: "https://atrium.ieeesbnu.org",
  logo: "https://atrium.ieeesbnu.org/logo-v1.png",
  description:
    "Atrium is the official portal of IEEE Student Branch, Nirma University – managing events, memberships, and chapter activities.",
  parentOrganization: {
    "@type": "Organization",
    name: "IEEE",
    url: "https://www.ieee.org",
  },
  memberOf: {
    "@type": "EducationalOrganization",
    name: "Nirma University",
    url: "https://nirmauni.ac.in",
  },
  sameAs: [
    "https://ieeesbnu.org",
    "https://www.instagram.com/ieeesbnu/",
    "https://www.linkedin.com/company/ieeesbnu/",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* JSON-LD Structured Data for search engines */}
        <Script
          id="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap" rel="stylesheet" />
        {/* Theme color for Chrome, Brave, Edge address bar */}
        <meta name="theme-color" content="#006699" />
        {/* Safari pinned tab & status bar */}
        <meta name="apple-mobile-web-app-title" content="Atrium" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <Analytics />
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
