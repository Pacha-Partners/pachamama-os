import { EST_VERSION_EN_LIGNE, VERSION_DEPLOYEE } from '@/lib/config';
import { redirect } from 'next/navigation';
import { BandeauDemo } from '@/components/vues/BandeauDemo';
import { EspaceTalent } from '@/components/vues/EspaceTalent';
import { TALENT } from '@/lib/demo/talent';

export const metadata = { title: 'Démonstration — espace talent' };

export default function DemoTalent() {
  // Instantané figé : cette vue n'est pas encore présentable. On renvoie vers
  // l'application en ligne plutôt que de montrer un écran incomplet.
  if (!EST_VERSION_EN_LIGNE) redirect(VERSION_DEPLOYEE);

  return (
    <>
      <BandeauDemo vue="Espace talent" />
      <main id="contenu">
        <EspaceTalent {...TALENT} />
      </main>
    </>
  );
}
