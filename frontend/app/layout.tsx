import type { Metadata } from 'next';
import { Bricolage_Grotesque, Host_Grotesk, Instrument_Serif } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

/**
 * Les trois familles de la marque, et seulement elles.
 *
 * Le design system les charge par `@import` Google Fonts. Ici on les
 * auto-héberge : la requête bloquante disparaît et le texte ne saute plus au
 * chargement. Les familles sont identiques — c'est le mode de livraison qui
 * change, pas la typographie.
 */
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--police-display',
  display: 'swap',
});
const corps = Host_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--police-body',
  display: 'swap',
});
const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'normal', // Instrument Serif n'est JAMAIS en italique
  variable: '--police-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Pachamama OS', template: '%s · Pachamama OS' },
  description: 'Portails et sourcing adossés à la base talent unifiée de Pachamama.',
  robots: { index: false, follow: false },
};

export default function LayoutRacine({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${corps.variable} ${serif.variable}`}>
      <body className="min-h-dvh antialiased">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-black focus:px-4 focus:py-2 focus:text-white"
        >
          Aller au contenu principal
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
