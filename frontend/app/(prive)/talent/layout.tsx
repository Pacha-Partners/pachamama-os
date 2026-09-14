import { FournisseurToasts } from '@/components/pacha/Toast';
import { exigerVue } from '@/lib/acces';

/**
 * La disposition de l'espace talent.
 *
 * ELLE PORTE LE GARDE D'AFFICHAGE, une fois pour les sept routes en dessous —
 * même arbitrage que `entreprise/layout.tsx`. Une disposition Next ne connaît
 * pas le chemin demandé, mais celle-ci n'enveloppe QUE `/talent/**` : « avoir
 * le droit d'être ici » est donc une question qu'elle peut poser pour tout ce
 * qu'elle couvre.
 *
 * Ce n'est toujours PAS l'autorisation : celle-ci vit dans les policies
 * PostgreSQL. Un compte qui forcerait le passage ne lirait rien — `api.ma_fiche`
 * est filtrée sur `api.ma_fiche_talent()` et gardée par
 * `api.a_portail('talent')`. Le garde évite une page vide sans explication.
 *
 * ⚠ PAS DE `loading.tsx` À CE NIVEAU, ET C'EST MESURÉ.
 * Un `loading.tsx` pose une frontière `Suspense` autour du segment ET DE SES
 * ENFANTS. Next envoie alors la coquille immédiatement, et une réponse
 * commencée ne change plus de statut : `notFound()` rendrait la bonne page
 * avec un **HTTP 200**. C'est le défaut que le harnais des écrans du portail
 * entreprise avait trouvé en phase 1 (voir `components/vues/entreprise/
 * squelettes.tsx`). `/talent/candidatures/<uuid inconnu>` doit rendre 404 :
 * l'attente est donc portée par les routes feuilles et par des `Suspense`
 * internes, jamais par ce niveau.
 *
 * LE FOURNISSEUR DE TOASTS EST MONTÉ ICI, une fois. Sa région `aria-live` doit
 * exister AVANT qu'on y insère quoi que ce soit, et survivre à la navigation
 * entre les écrans — sinon l'accusé de réception d'un enregistrement
 * disparaîtrait au moment où la page se recharge.
 */
export default async function LayoutTalent({ children }: { children: React.ReactNode }) {
  await exigerVue('talent');
  return <FournisseurToasts>{children}</FournisseurToasts>;
}
