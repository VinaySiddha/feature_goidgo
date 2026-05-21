import './globals.css';
import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import { AuthProvider } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import AppShell from '@/components/AppShell';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Goidgo - Student ID Card Data Portal',
  description: 'Goidgo: Design | Print | Care. Collect student ID card data from multiple colleges with our professional printing portal.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={outfit.variable}>
      <body suppressHydrationWarning>
        <AuthProvider>
          <AppShell>
            <Header />
            {children}
          </AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
