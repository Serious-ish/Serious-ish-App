import type { Metadata } from 'next';
import { Outfit, Prata, Sora } from 'next/font/google';
import './globals.css';

// Same typefaces as the app, through next/font (Frontend Specification 3.3).
const prata = Prata({ weight: '400', subsets: ['latin'], variable: '--font-prata' });
const sora = Sora({ weight: ['500', '600'], subsets: ['latin'], variable: '--font-sora' });
const outfit = Outfit({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: 'Serious-ish Moderation',
  description: 'Staff-only moderation page',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${prata.variable} ${sora.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
