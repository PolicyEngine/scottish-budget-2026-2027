import { PolicyEngineShell } from "@policyengine/ui-kit/layout";
import "@policyengine/ui-kit/styles.css";

import './globals.css';

const SITE_URL = 'https://scottish-budget-2026-2027.vercel.app';
const TITLE = 'Scottish Budget 2026-27 Dashboard | PolicyEngine';
const DESCRIPTION =
  'Interactive analysis of the Scottish Budget 2026-27. Explore distributional impacts, household calculations, and validation against the SFC.';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  authors: [{ name: 'PolicyEngine' }],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'PolicyEngine',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    site: '@ThePolicyEngine',
  },
};

export const viewport = {
  themeColor: '#2C7A7B',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <PolicyEngineShell country="uk">{children}        </PolicyEngineShell>
      </body>
    </html>
  );
}
