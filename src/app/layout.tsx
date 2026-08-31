import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '@/components/shared/ServiceWorkerRegister';
import { CartHydration } from '@/components/shared/CartHydration';
import { SplashScreen } from '@/components/customer/SplashScreen';
import { getActiveStore } from '@/lib/data/get-store';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kabanas Delivery',
  description: 'Peça sua comida favorita com entrega rápida.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Kabanas',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#171717',
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await getActiveStore();

  return (
    <html lang="pt-BR">
      <body>
        <SplashScreen storeName={store?.name} tagline={store?.tagline} logoUrl={store?.logo_url} />
        {children}
        <CartHydration />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
