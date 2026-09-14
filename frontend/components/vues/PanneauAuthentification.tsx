'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { Champ } from '@/components/pacha/Champ';
import { Divider } from '@/components/pacha/Divider';
import { Selecteur } from '@/components/pacha/Selecteur';
import { clientNavigateur } from '@/lib/supabase/navigateur';

/**
 * Le panneau d'authentification : se connecter, ou créer un compte.
 *
 * DEUX VUES DANS UNE SEULE CARTE, et non deux pages. Le geste « je n'ai pas
 * encore de compte » est un aller-retour, pas un départ : changer d'URL ferait
 * perdre la saisie en cours et rendrait le retour maladroit. La carte garde
 * donc sa place et son cadre, seul son contenu change.
 *
 * LE RÔLE N'EST DEMANDÉ QU'À LA CRÉATION. Se connecter n'a pas besoin de
 * savoir qui vous êtes : la base le sait déjà, par `app.acces`. Le demander à
 * l'entrée serait une question dont la réponse est déjà écrite — et une
 * occasion de se tromper.
 *
 * DEUX RÔLES SEULEMENT, candidat et entreprise. L'accès recruteur est un accès
 * INTERNE : il s'accorde depuis le back-office, il ne se demande pas. Le
 * sélecteur ne le propose donc pas, et la page ne l'explique pas non plus —
 * l'écran de connexion n'est pas l'endroit où l'on documente l'organisation.
 *
 * LA CONNEXION EST RÉELLE. `signInWithPassword` frappe la session, le client
 * `@supabase/ssr` écrit le cookie, `router.refresh()` en avertit le serveur —
 * sans ce dernier, on serait connecté côté navigateur et anonyme côté serveur,
 * et la racine renverrait sur cette même page. La destination n'est pas décidée
 * ici : on repasse par `/`, qui lit `api.moi` et oriente. Une seule règle
 * d'aiguillage dans l'application.
 *
 * ⚠ SAUF QUAND UNE `suite` EST FOURNIE, et c'est le correctif du parcours
 * « Postuler ». Quelqu'un qui clique « Postuler » sur une offre sans être
 * connecté arrive ici avec `?suite=/offres/<uuid>` : le renvoyer sur `/` le
 * déposerait sur son tableau de bord, sans l'offre, sans rien pour lui dire ce
 * qu'il était venu faire. La valeur est VALIDÉE côté serveur par
 * `cheminInterne` dans `app/login/page.tsx` — ce composant reçoit un chemin
 * déjà jugé interne et ne le rejuge pas, parce qu'une validation faite à deux
 * endroits finit par diverger, et que celle qui compte est celle du serveur.
 *
 * ⚠ LA CRÉATION DE COMPTE, ELLE, NE FAIT TOUJOURS RIEN. Elle valide la saisie
 * et s'arrête : `signUp` reste à écrire, et il faudra décider ce qu'un compte
 * neuf devient quand son adresse ne rencontre personne dans le modèle.
 */

type Vue = 'connexion' | 'creation';
type Role = 'candidat' | 'entreprise';

const ROLES = [
  { valeur: 'candidat' as const, libelle: 'Candidat' },
  { valeur: 'entreprise' as const, libelle: 'Entreprise' },
];

/** Volontairement permissive : elle écarte les fautes de frappe, pas les adresses exotiques. */
const ADRESSE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const LONGUEUR_MINIMALE = 8;

type Erreurs = Partial<
  Record<'courriel' | 'motDePasse' | 'confirmation' | 'societe' | 'siteWeb', string>
>;

export function PanneauAuthentification({
  sansAcces = false,
  suite = null,
}: {
  sansAcces?: boolean;
  /** Chemin INTERNE où revenir après connexion. Validé par `app/login/page.tsx`. */
  suite?: string | null;
}) {
  const titreId = useId();
  const router = useRouter();

  const [vue, setVue] = useState<Vue>('connexion');
  const [role, setRole] = useState<Role>('candidat');

  const [courriel, setCourriel] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [societe, setSociete] = useState('');
  const [siteWeb, setSiteWeb] = useState('');

  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [valide, setValide] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const enCreation = vue === 'creation';
  const entreprise = enCreation && role === 'entreprise';

  /** Repart d'une carte propre : ni erreur d'une vue précédente, ni message de succès. */
  function changerDeVue(cible: Vue) {
    setVue(cible);
    setErreurs({});
    setValide(false);
    setRefus(null);
  }

  function verifier(): Erreurs {
    const e: Erreurs = {};

    if (!courriel.trim()) e.courriel = 'Une adresse électronique est nécessaire.';
    else if (!ADRESSE.test(courriel.trim())) e.courriel = 'Cette adresse ne semble pas valide.';

    if (!motDePasse) e.motDePasse = 'Un mot de passe est nécessaire.';
    else if (enCreation && motDePasse.length < LONGUEUR_MINIMALE)
      e.motDePasse = `Au moins ${LONGUEUR_MINIMALE} caractères.`;

    if (enCreation) {
      if (!confirmation) e.confirmation = 'Confirmez le mot de passe.';
      else if (confirmation !== motDePasse) e.confirmation = 'Les deux mots de passe diffèrent.';
    }

    if (entreprise) {
      if (!societe.trim()) e.societe = 'Le nom de la société est nécessaire.';
      // Le site est une PISTE D'IDENTIFICATION du client, pas une décoration :
      // c'est par lui que le dédoublonnage des entreprises se fait côté source.
      if (!siteWeb.trim()) e.siteWeb = 'Le site de la société est nécessaire.';
      else if (!/\./.test(siteWeb.trim()) || /\s/.test(siteWeb.trim()))
        e.siteWeb = 'Indiquez une adresse de site, par exemple pachamama-collective.com.';
    }

    return e;
  }

  /** Ce que Supabase répond, dit en français. Le message brut est anglais. */
  function traduire(message: string): string {
    if (/invalid login credentials/i.test(message)) {
      return 'Adresse ou mot de passe incorrect.';
    }
    if (/email not confirmed/i.test(message)) {
      return 'Cette adresse n’a pas encore été confirmée.';
    }
    if (/rate limit|too many/i.test(message)) {
      return 'Trop de tentatives. Réessayez dans quelques instants.';
    }
    return 'La connexion a échoué. Réessayez, ou signalez-le si cela persiste.';
  }

  async function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    setRefus(null);
    const e = verifier();
    setErreurs(e);
    if (Object.keys(e).length > 0) {
      setValide(false);
      return;
    }

    if (enCreation) {
      // La saisie est bonne, et c'est tout ce que cette vue sait faire
      // aujourd'hui. Le dire vaut mieux qu'un bouton qui ne réagit pas.
      setValide(true);
      return;
    }

    setEnCours(true);
    try {
      const { error } = await clientNavigateur().auth.signInWithPassword({
        email: courriel.trim(),
        password: motDePasse,
      });
      if (error) {
        setRefus(traduire(error.message));
        return;
      }
      // Le serveur doit relire le cookie AVANT qu'on le renvoie, sinon il croit
      // la session encore fermée et renvoie ici même.
      router.refresh();
      // Avec une `suite`, on y va ; sinon on repasse par la racine, qui lit
      // `api.moi` et oriente. La racine reste la seule règle d'aiguillage.
      router.replace(suite ?? '/');
    } catch {
      setRefus('La connexion a échoué. Vérifiez votre accès au réseau.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={soumettre} noValidate className="flex flex-col gap-5" aria-labelledby={titreId}>
      <h2 id={titreId} className="t-h2">
        {enCreation ? 'Créer un compte' : 'Connexion'}
      </h2>

      {sansAcces && !enCreation && (
        <p className="t-caption rounded-[var(--r-sm)] border border-[var(--encre-100)] bg-[var(--fond-entete)] px-3 py-2 text-black">
          Vous êtes authentifié, mais aucun accès n’est rattaché à cette adresse. Un
          administrateur doit la relier à votre profil.
        </p>
      )}

      {enCreation && (
        <Selecteur
          libelle="Je crée un compte en tant que"
          options={ROLES}
          valeur={role}
          onChangement={(v) => {
            if (v) setRole(v);
            setErreurs({});
            setValide(false);
          }}
          substitut="Choisir un profil"
          requis
        />
      )}

      {entreprise && (
        <>
          <Champ
            libelle="Nom de la société"
            value={societe}
            onChange={(e) => setSociete(e.target.value)}
            erreur={erreurs.societe}
            placeholder="Pachamama"
            autoComplete="organization"
            requis
          />
          <Champ
            libelle="Site de la société"
            value={siteWeb}
            onChange={(e) => setSiteWeb(e.target.value)}
            erreur={erreurs.siteWeb}
            placeholder="pachamama-collective.com"
            inputMode="url"
            autoComplete="url"
            requis
          />
        </>
      )}

      <Champ
        libelle="Adresse électronique"
        type="email"
        value={courriel}
        onChange={(e) => setCourriel(e.target.value)}
        erreur={erreurs.courriel}
        placeholder="vous@exemple.com"
        autoComplete="email"
        inputMode="email"
        requis
      />

      <Champ
        libelle="Mot de passe"
        type="password"
        value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)}
        erreur={erreurs.motDePasse}
        aide={enCreation ? `Au moins ${LONGUEUR_MINIMALE} caractères.` : undefined}
        autoComplete={enCreation ? 'new-password' : 'current-password'}
        requis
      />

      {enCreation && (
        <Champ
          libelle="Confirmer le mot de passe"
          type="password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          erreur={erreurs.confirmation}
          autoComplete="new-password"
          requis
        />
      )}

      {/* `aria-live` : le message naît après coup, il faut qu'il soit annoncé. */}
      <p aria-live="polite" className="sr-only">
        {valide ? 'Saisie valide. La création de compte n’est pas encore active.' : ''}
      </p>

      {/* Même convention que le design system pour l'erreur : le filet rouge
          #ff2626 de `CHAMP_ERREUR` — un littéral, l'échelle n'a pas de jeton
          rouge — et le texte en NOIR, comme `MessageErreur`. Pas de texte
          rouge : la règle dure du DS est que le texte reste noir. */}
      {refus && (
        <p
          role="alert"
          className="t-caption-hl rounded-[var(--r-sm)] border border-[#ff2626] bg-white px-3 py-2 text-black"
        >
          {refus}
        </p>
      )}

      {valide && (
        <p className="t-caption rounded-[var(--r-sm)] bg-[var(--people-100)] px-3 py-2 text-black">
          Saisie valide. La création de compte n’est pas encore branchée : rien n’est
          envoyé pour l’instant.
        </p>
      )}

      <Bouton type="submit" apparence="plein" className="w-full" disabled={enCours}>
        {enCreation ? 'Créer mon compte' : enCours ? 'Connexion…' : 'Se connecter'}
      </Bouton>

      <Divider />

      <div className="flex flex-col gap-2">
        <p className="t-caption text-[var(--encre-500)]">
          {enCreation ? 'Vous avez déjà un compte ?' : 'Vous n’avez pas encore de compte ?'}
        </p>
        <Bouton
          apparence="contour"
          className="w-full"
          onClick={() => changerDeVue(enCreation ? 'connexion' : 'creation')}
        >
          {enCreation ? 'Revenir à la connexion' : 'Créer un compte'}
        </Bouton>
      </div>
    </form>
  );
}
