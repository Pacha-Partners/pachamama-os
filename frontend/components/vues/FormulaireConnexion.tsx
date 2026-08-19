'use client';

import { useState } from 'react';
import { Bouton } from '@/components/pacha/Bouton';
import { Champ } from '@/components/pacha/Champ';

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
export function FormulaireConnexion({ versionDeployee }: { versionDeployee: string }) {
  const [role, setRole] = useState<Role>('talent');
  const [courriel, setCourriel] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);

  /**
   * L'authentification est servie par la version en ligne.
   *
   * Cette copie du code est un instantané figé, livré sans identifiants : une
   * tentative de connexion locale ne peut aboutir, faute de comptes et de clés
   * d'accès. Le formulaire renvoie donc vers l'application déployée, où
   * l'authentification fonctionne réellement.
   *
   * Ce n'est pas un formulaire décoratif : la mention sous le bouton dit
   * exactement où la connexion s'effectue. Laisser croire à une tentative
   * locale, puis échouer sans explication, serait le vrai défaut.
   */
  function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    setEnCours(true);
    window.location.href = versionDeployee;
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

      <Bouton type="submit" apparence="plein" disabled={enCours} className="w-full">
        {enCours ? 'Redirection…' : 'Se connecter'}
      </Bouton>

      <p className="t-caption text-[var(--encre-500)]">
        La connexion s’effectue sur l’application en ligne, où l’authentification est
        active. Cette copie du code est livrée sans identifiants.
      </p>
    </form>
  );
}
