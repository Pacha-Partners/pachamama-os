import { Squelette, SqueletteCarte, SqueletteTexte } from '@/components/pacha/Squelette';

/**
 * L'attente de cet écran.
 *
 * ⚠ CE `loading.tsx` EST SUR UNE ROUTE FEUILLE, ET C'EST LA CONDITION.
 * Un `loading.tsx` pose une frontière `Suspense` autour du segment ET DE SES
 * ENFANTS : posé sur `/talent`, il aurait couvert
 * `/talent/candidatures/[id]` et transformé son `notFound()` en HTTP 200 —
 * défaut mesuré en phase 1. Cette route n'a pas d'enfant et n'appelle jamais
 * `notFound()` : la frontière est donc sans danger ici.
 *
 * `role="status"` et non `aria-label` seul : sur un `<div>` nu, dont le rôle
 * est `generic`, `aria-label` n'est pas exposé. Les squelettes étant
 * `aria-hidden`, l'attente ne s'annoncerait nulle part.
 */
export default function Chargement() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 pb-16 pt-2"
    >
      <span className="sr-only">Chargement de votre profil</span>
      <div className="flex flex-col gap-3">
        <Squelette largeur="32%" hauteur={30} />
        <SqueletteTexte lignes={2} className="max-w-[60ch]" />
      </div>
      {Array.from({ length: 2 }, (_, i) => (
        <SqueletteCarte key={i} avecVignette={false} lignes={4} />
      ))}
    </div>
  );
}
