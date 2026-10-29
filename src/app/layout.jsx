import { PolicyEngineShell } from "@policyengine/ui-kit/layout";
import "@policyengine/ui-kit/styles.css";

import './globals.css';
import Script from 'next/script';

// The canonical address: policyengine.org serves this app through a zone
// rewrite, so links and link previews name it, not the Vercel deployment.
const SITE_URL = 'https://policyengine.org/uk/scottish-budget-2026-27';
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
        {/* Google Analytics: policyengine.org's GA4 property; this app is served at
         * policyengine.org/uk/scottish-budget-2026-27 through a rewrite, where the main site's GA does not reach. */}
        {process.env.NODE_ENV === 'production' && (
          <>
            <Script
              src="https://www.googletagmanager.com/gtag/js?id=G-2YHG89FY0N"
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-2YHG89FY0N');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
