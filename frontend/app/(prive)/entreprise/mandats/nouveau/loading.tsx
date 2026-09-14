import { Squelette, SqueletteCarte, SqueletteTexte } from '@/components/pacha/Squelette';

/** L'attente du formulaire de brief : le fil des étapes, puis la première carte. */
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
      <span className="sr-only">Chargement du formulaire</span>
      <div className="flex flex-col gap-3">
        <Squelette forme="texte" largeur={120} />
        <Squelette largeur="28%" hauteur={30} />
        <SqueletteTexte lignes={2} className="max-w-[64ch]" />
      </div>
      <div className="flex gap-2" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <Squelette key={i} largeur={110} hauteur={30} />
        ))}
      </div>
      <div className="max-w-[840px]">
        <SqueletteCarte avecVignette={false} lignes={5} />
      </div>
    </div>
  );
}
