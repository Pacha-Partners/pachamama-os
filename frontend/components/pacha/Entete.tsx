'use client';

import { Avatar } from './Avatar';
import { Champ } from './Champ';
import { Divider } from './Divider';
import { Icone } from './Icone';
import { cn } from '@/lib/utils';

/**
 * Entete — la barre supérieure.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IL N'Y A QU'UN EN-TÊTE, ET IL N'A PAS D'AXE DE VARIANTE
 * ────────────────────────────────────────────────────────────────────────────
 * `User={Admin, Talent}` n'appartient PAS à l'en-tête : ces deux calques sont les
 * variantes du composant `Menu` (Figma.md:33606 et Figma.md:34252, tous deux
 * enfants du cadre nommé « Menu » à Figma.md:33587). L'unique `Header` de
 * l'application est à Figma.md:11407 et n'a aucune variante. De même,
 * `icon-log-out` vit dans le menu (Figma.md:34225, 34686) : les occurrences de
 * Figma.md:11759 et 11779 sont des planches d'icônes détachées (`position:
 * relative`, hors auto layout), pas des enfants de l'en-tête — dont le bloc de
 * droite mesure exactement 276px = 44 (cloche) + 16 (gap) + 216 (utilisateur),
 * ce qui ne laisse la place à rien d'autre.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * COTES RELEVÉES (Figma.md:11407)
 * ────────────────────────────────────────────────────────────────────────────
 *   barre       hauteur 76, `padding: 16px 24px 16px 192px`, `space-between`
 *   recherche   286×36, centrée (`margin: 0 auto`), fond blanc, filet noir 1px,
 *               rayon 8 (Figma.md:11467-11482) ; placeholder
 *               « Chercher un.e candidat.e » en `--encre-300` (Figma.md:11511)
 *   droite      `gap: 16px` (Figma.md:11590)
 *   cloche      44×44, fond blanc, rond, icône 20×20 en `--violet-700`
 *               (Figma.md:11628-11665)
 *   utilisateur `padding-left: 16px`, `gap: 8px`, filet vertical à gauche
 *               `1px #F1F0F5` (Figma.md:11673-11695), photo 38×38 sans filet ni
 *               rayon (Figma.md:11705), nom en 16/18 demi-gras (Figma.md:11738)
 *
 * ARBITRAGES.
 * · Le retrait gauche de 192px du Figma existe parce que la barre passe SOUS le
 *   panneau de navigation (180 + 12). On le garde tel quel : c'est une cote
 *   relevée, pas une supposition. Une mise en page où l'en-tête est frère du menu
 *   plutôt que dessous doit l'écraser via `className`.
 * · Le fond du Figma est `#FFF9E5`, relevé une seule fois dans tout l'export
 *   (Figma.md:11421), alors que `#FFFBF0` y apparaît quinze fois et qu'app.css l'a
 *   déjà retenu comme `--fond-entete`. app.css arbitre explicitement les crèmes
 *   quasi-doublons ; on ne crée pas un troisième crème pour une occurrence
 *   unique. L'écart est consigné.
 * · Le nom est en 'Montserrat' 600 16/18 dans le Figma. Montserrat est hors
 *   charte (app.css l'écarte déjà) et l'échelle typographique n'a pas de style
 *   16/18 : la valeur est écrite littéralement avec la famille du DS, et le style
 *   manquant est consigné.
 * · La hauteur relevée est 76px, quand `--nav-hauteur` vaut 64px. Le Figma
 *   gouverne l'interface : 76px. Consigné.
 * · Le compteur de notifications n'est PAS dans le Figma — la cloche y est nue.
 *   Il est conservé parce qu'une pastille muette ne dit pas combien, et son
 *   nombre est porté en texte dans `aria-label`. C'est un ajout assumé.
 */
export function Entete({
  utilisateur,
  notifications = 0,
  placeholderRecherche = 'Chercher un.e candidat.e', // Figma.md:11511, ponctuation comprise
  onRecherche,
  onNotifications,
  className,
}: {
  utilisateur: { nom: string; photoUrl?: string | null };
  notifications?: number;
  placeholderRecherche?: string;
  onRecherche?: (valeur: string) => void;
  onNotifications?: () => void;
  className?: string;
}) {
  return (
    <header
      className={cn(
        // Figma.md:11414 — padding 16px 24px 16px 192px, hauteur 76.
        'flex h-[76px] items-center justify-between gap-6 pl-[192px] pr-6',
        'bg-[var(--fond-entete)]',
        className,
      )}
    >
      {/* Figma.md:11424 — `margin: 0 auto` : la recherche est centrée dans son
          emplacement, pas collée à gauche. */}
      <Champ
        recherche
        placeholder={placeholderRecherche}
        aria-label={placeholderRecherche}
        onChange={onRecherche ? (e) => onRecherche(e.currentTarget.value) : undefined}
        className="mx-auto w-[286px]" // Figma.md:11431
      />

      <div className="flex items-center gap-4">
        {/* Figma.md:11628 — 44×44, fond blanc, rayon complet. */}
        <button
          type="button"
          onClick={onNotifications}
          aria-label={
            notifications > 0 ? `Notifications, ${notifications} non lues` : 'Notifications'
          }
          className="relative grid size-11 place-items-center rounded-[var(--r-full)] bg-white"
        >
          {/* Figma.md:11665 — icône 20×20, `#5022C3` = --violet-700. */}
          <Icone nom="icon-bell" className="size-5 text-[var(--violet-700)]" />
          {notifications > 0 && (
            <span
              aria-hidden="true"
              className="t-micro-bold absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-[var(--r-full)] bg-[var(--statut-echec)] text-black"
            >
              {notifications > 9 ? '9+' : notifications}
            </span>
          )}
        </button>

        {/* Figma.md:11695 — le bloc utilisateur est détaché par un filet vertical. */}
        <Divider orientation="vertical" className="h-[38px]" />

        <div className="flex items-center gap-2">
          {/* Figma.md:11705 — 38×38, ni filet ni rayon. */}
          <Avatar nom={utilisateur.nom} src={utilisateur.photoUrl} taille={38} bordure={false} />
          {/* Figma.md:11738 — 16/18 demi-gras, noir. Aucun style nommé du DS ne
              couvre 16/18 : valeur littérale, famille du DS. */}
          <span className="truncate font-[family-name:var(--font-body)] text-[16px] font-semibold leading-[18px] text-black">
            {utilisateur.nom}
          </span>
        </div>
      </div>
    </header>
  );
}
