import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wireflow - Free Wire / User Flow Tool",
  description:
    "Wireflow is a free, online and open source tool for creating beautiful user flow prototypes. No Photoshop skills required.",
  applicationName: "Wireflow",
  metadataBase: new URL("https://wireflow.co"),
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Wireflow",
    title: "Wireflow - Free Wire / User Flow Tool",
    description:
      "Wireflow is a free, online and open source tool for creating beautiful user flow prototypes. No Photoshop skills required.",
    images: [{ url: "/icon-512.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Wireflow",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#465BFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <script
          async
          defer
          src="https://dokploy-rybbit-059dcf.automatio.run/api/script.js"
          data-site-id="3"
          data-api-key="rb_9893c5768820f59953ab49af2782f465"
        />
        {/* Google Analytics 4 — property WireFlow.co - GA4 (365729338) */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-GBPQX24QS2"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: "window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', 'G-GBPQX24QS2');",
          }}
        />
      </body>
    </html>
  );
}
