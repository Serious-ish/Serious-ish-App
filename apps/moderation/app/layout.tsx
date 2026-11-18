import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Serious-ish Moderation',
  description: 'Staff-only moderation page',
  robots: { index: false, follow: false },
};

// Fonts (Prata, Sora, Outfit) and the token CSS variables arrive with FT-003.
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
