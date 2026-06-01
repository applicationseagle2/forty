import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '40-Day Fast',
  description: 'A reverent way to organize 40 consecutive days of fasting in your congregation.',
  robots: { index: false, follow: false }, // app not search-indexable
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
