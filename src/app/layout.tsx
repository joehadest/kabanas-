import type { Metadata, Viewport } from 'next';
import { DM_Sans, Rye } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

/** Fonte display estilo “Kabanas” do banner — serifada Western/boteco. */
const rye = Rye({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-rye',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Boteco Kabanas Beer',
  description: 'Choperia e petiscaria — chopp gelado, petiscos na brasa e gestão do negócio.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Kabanas',
  },
  icons: {
    icon: [
      { url: '/brand/logo-mark.svg', type: 'image/svg+xml' },
      { url: '/brand/logo-kabanas.jpg', sizes: '512x512', type: 'image/jpeg' },
    ],
    apple: '/brand/logo-kabanas.jpg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#000000',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${dmSans.variable} ${rye.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
