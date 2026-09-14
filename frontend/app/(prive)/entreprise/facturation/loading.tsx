import { Squelette, SqueletteCarte, SqueletteLigneTableau, SqueletteTexte } from '@/components/pacha/Squelette';

/** L'attente de l'espace facturation : les tuiles, le contrat, le tableau. */
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
      <span className="sr-only">Chargement de votre facturation</span>
      <div className="flex flex-col gap-3">
        <Squelette largeur="28%" hauteur={30} />
        <SqueletteTexte lignes={2} className="max-w-[60ch]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="flex flex-col items-center gap-2 rounded-[var(--r-md)] bg-[var(--fond-carte)] p-4"
          >
            <Squelette hauteur={24} largeur={48} />
            <Squelette forme="texte" largeur="70%" />
          </div>
        ))}
      </div>
      <SqueletteCarte avecVignette={false} lignes={3} />
      <div className="rounded-[var(--r-md)] border border-[var(--encre-100)] bg-[var(--fond-carte)]">
        {Array.from({ length: 4 }, (_, i) => (
          <SqueletteLigneTableau key={i} colonnes={6} />
        ))}
      </div>
    </div>
  );
}
