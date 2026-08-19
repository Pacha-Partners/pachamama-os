import { cn } from '@/lib/utils';

/**
 * Titre — le duo de la marque.
 *
 * Règle non négociable de la charte : jamais une ligne sans l'autre. La ligne
 * descriptive est en Instrument Serif, la ligne d'impact en Bricolage
 * Grotesque SemiBold, et **les deux ont la même taille** — la hiérarchie vient
 * du contraste serif/sans, jamais d'un écart de corps. C'est ce qui distingue
 * un titre Pachamama d'un titre générique.
 */
export function Titre({
  niveau = 2,
  descriptif,
  impact,
  className,
}: {
  niveau?: 1 | 2;
  /** La ligne descriptive, en serif. Optionnelle uniquement pour un H3 d'interface. */
  descriptif?: string;
  /** La ligne d'impact, en sans. Toujours présente. */
  impact: string;
  className?: string;
}) {
  const Balise = niveau === 1 ? 'h1' : 'h2';
  return (
    <Balise className={cn('flex flex-col gap-1.5', className)}>
      {descriptif && (
        <span className={niveau === 1 ? 't-h1-comp' : 't-h2-comp'}>{descriptif}</span>
      )}
      <span className={niveau === 1 ? 't-h1' : 't-h2'}>{impact}</span>
    </Balise>
  );
}

/** Titre de section d'interface — pas de duo à ce niveau, le Figma non plus. */
export function TitreSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('t-h3', className)}>{children}</h3>;
}
