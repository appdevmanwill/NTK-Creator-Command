import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ToastProvider } from '@/components/ToastProvider';
import { ExperienceModeProvider } from '@/components/ExperienceModeProvider';
import { QuickHelpDrawer } from '@/components/QuickHelpDrawer';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'NTK Creator Command',
  description: 'Beginner-friendly local creator studio for digital products, AI video packs, and YouTube research by NTK Hub.',
};

const noFoucScript = `
(function() {
  try {
    var m = localStorage.getItem('ntk-theme-mode') || 'system';
    var resolved = m === 'light' || m === 'dark' ? m : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', resolved);
    if (resolved === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#070b14" />
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
