import { redirect } from 'next/navigation';
import { BandeauDemo } from '@/components/vues/BandeauDemo';
import { EspaceEntreprise } from '@/components/vues/EspaceEntreprise';
import { EST_VERSION_EN_LIGNE, VERSION_DEPLOYEE } from '@/lib/config';
import { ENTREPRISE } from '@/lib/demo/entreprise';

export const metadata = { title: 'Démonstration — portail entreprise' };

export default function DemoEntreprise() {
  if (!EST_VERSION_EN_LIGNE) redirect(VERSION_DEPLOYEE);
  return (
    <>
      <BandeauDemo vue="Portail entreprise" />
      <main id="contenu">
        <EspaceEntreprise {...ENTREPRISE} />
      </main>
    </>
  );
}
