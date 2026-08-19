'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Bouton } from '@/components/pacha/Bouton';
import { Champ } from '@/components/pacha/Champ';
import { clientNavigateur } from '@/lib/supabase/navigateur';

type Role = 'talent' | 'entreprise' | 'recruteur';

const ROLES: { cle: Role; libelle: string; emoji: string; description: string }[] = [
  {
    cle: 'talent',
    libelle: 'Talent',
    emoji: '🙋',
    description: 'Mon profil, mes attentes et mes candidatures.',
  },
  {
    cle: 'entreprise',
    libelle: 'Entreprise',
    emoji: '🏢',
    description: 'Le suivi anonymisé de mes candidats.',
  },
  {
    cle: 'recruteur',
    libelle: 'Recruteur',
    emoji: '🎯',
    description: 'Le Chasseur de Talents.',
  },
];

/**
 * Formulaire de connexion.
 *
 * Le sélecteur de rôle est une aide à l'orientation, PAS un contrôle d'accès.
 * Le rôle réel est lu côté serveur dans `app_metadata`, et l'autorisation vit
 * dans les policies PostgreSQL : choisir « Recruteur » ici ne donne rien de plus
 * à un compte talent. Le proposer quand même a une valeur d'usage — l'écran
 * annonce ce que chaque profil va trouver derrière — mais il ne faut pas s'y
 * tromper sur ce qu'il fait.
 *
 * Quand l'environnement n'est pas configuré, la construction du client lève. On
 * l'attrape pour afficher une explication utile plutôt qu'une erreur technique :
 * c'est l'état normal du déploiement de démonstration, qui ne porte aucune clé.
 */
export function FormulaireConnexion() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('talent');
  const [courriel, setCourriel] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      const supabase = clientNavigateur();
      const { error } = await supabase.auth.signInWithPassword({
        email: courriel,
        password: motDePasse,
      });
      if (error) {
        // Message volontairement identique pour un compte inconnu et un mot de
        // passe faux : distinguer les deux révèle quelles adresses existent.
        setErreur('Adresse ou mot de passe incorrect.');
        return;
      }
      // La redirection est décidée côté serveur, à partir du rôle réel.
      router.replace('/');
      router.refresh();
    } catch {
      setErreur(
        'L’authentification n’est pas configurée sur cet environnement. Utilisez la version de démonstration ci-contre.',
      );
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={soumettre} className="flex flex-col gap-5" noValidate>
      <fieldset>
        <legend className="t-caption-hl mb-2 text-[var(--encre-600)]">Je me connecte en tant que</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ROLES.map((r) => {
            const actif = role === r.cle;
            return (
              <label
                key={r.cle}
                className={[
                  'flex cursor-pointer flex-col gap-1 rounded-[var(--r-md)] border-2 p-3 transition-shadow',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-black',
                  actif
                    ? 'border-black bg-[var(--violet-050)] shadow-[var(--ombre-2)]'
                    : 'border-[var(--encre-200)] bg-white hover:border-black',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.cle}
                  checked={actif}
                  onChange={() => setRole(r.cle)}
                  className="sr-only"
                />
                <span className="t-caption-bold flex items-center gap-1.5 text-black">
                  <span aria-hidden="true">{r.emoji}</span>
                  {r.libelle}
                </span>
                <span className="t-caption text-[var(--encre-500)]">{r.description}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Champ
        libelle="Adresse électronique"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={courriel}
        onChange={(e) => setCourriel(e.target.value)}
        placeholder="vous@exemple.com"
      />

      <Champ
        libelle="Mot de passe"
        type="password"
        name="password"
        autoComplete="current-password"
        required
        value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)}
      />

      {/* L'erreur est annoncée en texte et dans une région signalée : une
          bordure rouge seule serait invisible pour qui ne la distingue pas. */}
      {erreur && (
        <p role="alert" className="t-caption rounded-[var(--r-sm)] bg-[var(--product-100)] px-3 py-2 text-black">
          {erreur}
        </p>
      )}

      <Bouton type="submit" apparence="plein" disabled={enCours} className="w-full">
        {enCours ? 'Connexion…' : 'Se connecter'}
      </Bouton>
    </form>
  );
}
