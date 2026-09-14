import { Squelette, SqueletteCarte, SqueletteTexte } from '@/components/pacha/Squelette';

/** L'attente du profil : le titre, les deux onglets, les deux cartes de saisie. */
export default function Chargement() {
  return (
    // `role="status"` et non `aria-label` seul : sur un `<div>` nu, dont le
    // rôle est `generic`, `aria-label` n'est pas exposé. Les squelettes étant
    // `aria-hidden`, l'attente ne s'annonçait nulle part.
    <div
      role="status"
      aria-busy="true"
      className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 pb-16 pt-2"
    >
      <span className="sr-only">Chargement de votre fiche</span>
      <div className="flex flex-col gap-3">
        <Squelette largeur="30%" hauteur={30} />
        <SqueletteTexte lignes={2} className="max-w-[60ch]" />
      </div>
      <div className="flex gap-4 border-b border-[var(--encre-100)] pb-2" aria-hidden="true">
        <Squelette forme="texte" largeur={140} />
        <Squelette forme="texte" largeur={110} />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <SqueletteCarte avecVignette={false} lignes={6} />
          <SqueletteCarte avecVignette={false} lignes={4} />
        </div>
        <SqueletteCarte avecVignette={false} lignes={4} />
      </div>
    </div>
  );
}
