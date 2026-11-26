import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ToastProvider } from '@/components/ToastProvider';
import { ExperienceModeProvider } from '@/components/ExperienceModeProvider';
import { QuickHelpDrawer } from '@/components/QuickHelpDrawer';
import { AppShell } from '@/components/AppShell';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f3ec' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export const metadata: Metadata = {
  title: 'NTK Creator Command — Private Creator Atelier',
  description:
    'Local-first editorial studio for digital publications, formula models, cinema prompt packs, and channel intelligence by NTK Hub.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NTK Creator Command',
  },
};

const noFoucScript = `
(function() {
  try {
    var m = localStorage.getItem('ntk-theme-mode') || 'system';
    var resolved = m === 'light' || m === 'dark' ? m : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', resolved);
    if (resolved === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#09090b' : '#f6f3ec');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${cormorant.variable} ${jakarta.variable} ${jetbrains.variable}`}
    >
      <head>
        <meta name="theme-color" content="#09090b" />
        <script dangerouslySetInnerHTML={{ __html: noFoucScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <ExperienceModeProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
              <QuickHelpDrawer />
            </ToastProvider>
          </ExperienceModeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
