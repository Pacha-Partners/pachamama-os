import { BandeauDemo } from '@/components/vues/BandeauDemo';
import { EspaceTalent } from '@/components/vues/EspaceTalent';
import { TALENT } from '@/lib/demo/talent';

export const metadata = { title: 'Démonstration — espace talent' };

export default function DemoTalent() {
  return (
    <>
      <BandeauDemo vue="Espace talent" />
      <main id="contenu">
        <EspaceTalent {...TALENT} />
      </main>
    </>
  );
}
