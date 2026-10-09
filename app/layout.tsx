// Reconstructed from the production HTML <head> and the RSC root-layout tree (build Jp7MF3_aUxMDjVuOFifu0).
// Analytics are configured with env vars (lib/env.ts) instead of being hard-coded.
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { analytics } from '@/lib/env';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

const title = 'Wireflow - Free Wire / User Flow Tool';
const description = 'Wireflow is a free, online and open source tool for creating beautiful user flow prototypes. No Photoshop skills required.';

export const metadata: Metadata = {
  metadataBase: new URL('https://wireflow.co'),
  title,
  description,
  applicationName: 'Wireflow',
  appleWebApp: { capable: true, title: 'Wireflow', statusBarStyle: 'default' },
  openGraph: {
    title,
    description,
    url: 'https://wireflow.co',
    siteName: 'Wireflow',
    images: [{ url: 'https://wireflow.co/icon-512.png', width: 512, height: 512 }],
    type: 'website',
  },
  twitter: { card: 'summary', title, description, images: [{ url: 'https://wireflow.co/icon-512.png', width: 512, height: 512 }] },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = { themeColor: '#465BFF' };

// Analytics load only when configured; see README "Environment variables".
const { rybbit, gaId } = analytics();

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        {rybbit && <script async defer src={rybbit.src} data-site-id={rybbit.siteId} />}
        {gaId && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', '${gaId}');`,
              }}
            />
          </>
        )}
      </body>
    </html>
  );
}
