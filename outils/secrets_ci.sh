#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# Poser les secrets dont la CI a besoin, depuis les fichiers locaux.
#
#     bash outils/secrets_ci.sh
#
# ⚠ CE SCRIPT NE CONTIENT AUCUNE VALEUR, ET N'EN AFFICHE AUCUNE. Il lit
# `env/projets.env` et `frontend/.env.local` — tous deux ignorés par git —
# et transmet chaque valeur à `gh` par l'entrée standard.
#
# POURQUOI PAR L'ENTRÉE STANDARD ET NON `--body`. Un argument de ligne de
# commande est visible dans la table des processus : `ps aux` le montre à
# tout utilisateur de la machine pendant le temps de l'appel. L'entrée
# standard, non.
#
# CE QUE FAIT `gh secret set`. Il chiffre la valeur SUR CE POSTE avec la clé
# publique du dépôt (scellé libsodium) avant de l'envoyer. GitHub la stocke
# chiffrée, l'injecte dans les workflows, et masque toute occurrence dans
# les journaux. Elle n'est plus relisible ensuite — on ne peut que la
# remplacer.
#
# ⚠ TROIS VALEURS NE SONT DANS AUCUN FICHIER et sont demandées à la saisie :
#   · SUPABASE_ACCESS_TOKEN      supabase.com/dashboard/account/tokens
#   · SUPABASE_DB_PASSWORD_DEV   tableau de bord → Settings → Database
#   · SUPABASE_DB_PASSWORD_LIVE  idem, sur le projet de production
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJETS="$RACINE/env/projets.env"
LOCAL="$RACINE/frontend/.env.local"

command -v gh >/dev/null || { echo "gh est absent."; exit 2; }
gh auth status >/dev/null 2>&1 || { echo "gh n'est pas authentifié : gh auth login"; exit 2; }
[ -f "$PROJETS" ] || { echo "introuvable : $PROJETS"; exit 2; }
[ -f "$LOCAL" ]   || { echo "introuvable : $LOCAL"; exit 2; }

# Lit une variable dans un fichier .env sans l'afficher.
lire() { sed -n "s/^$2=//p" "$1" | head -1 | tr -d '"'\''' | tr -d '\r'; }

poser() { # poser <NOM GITHUB> <valeur>
  local nom="$1" valeur="$2"
  if [ -z "$valeur" ]; then
    printf '  %-32s ABSENTE, ignorée\n' "$nom"
    return
  fi
  printf '%s' "$valeur" | gh secret set "$nom" >/dev/null
  printf '  %-32s posée (%d caractères)\n' "$nom" "${#valeur}"
}

echo "Dépôt : $(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo
echo "── Depuis env/projets.env ──"
poser SUPABASE_PROJECT_REF_DEV      "$(lire "$PROJETS" PACHA_DEV_REF)"
poser SUPABASE_URL_DEV              "$(lire "$PROJETS" PACHA_DEV_URL)"
poser SUPABASE_ANON_KEY_DEV         "$(lire "$PROJETS" PACHA_DEV_ANON_KEY)"
poser SUPABASE_SERVICE_ROLE_KEY_DEV "$(lire "$PROJETS" PACHA_DEV_SERVICE_ROLE_KEY)"
poser SUPABASE_PROJECT_REF_LIVE     "$(lire "$PROJETS" PACHA_LIVE_REF)"

echo
echo "── Depuis frontend/.env.local ──"
poser TEST_MDP              "$(lire "$LOCAL" TEST_MDP)"
poser TEST_ENTREPRISE_EMAIL "$(lire "$LOCAL" TEST_ENTREPRISE_EMAIL)"
poser TEST_TALENT_EMAIL     "$(lire "$LOCAL" TEST_TALENT_EMAIL)"
poser TEST_RECRUTEUR_EMAIL  "$(lire "$LOCAL" TEST_RECRUTEUR_EMAIL)"

# ── Le jeton du CLI est DÉJÀ dans le trousseau macOS.
# `supabase login` l'y a rangé sous le service « Supabase CLI ». Inutile d'en
# générer un nouveau : en créer un second multiplie les jetons vivants, donc la
# surface à révoquer le jour où l'un fuit. macOS demandera l'autorisation de
# lire l'entrée — c'est normal, et c'est vous qui l'accordez.
echo
echo "── Depuis le trousseau macOS ──"
if jeton="$(security find-generic-password -s 'Supabase CLI' -a supabase -w 2>/dev/null)" && [ -n "$jeton" ]; then
  poser SUPABASE_ACCESS_TOKEN "$jeton"
  unset jeton
  # ⚠ UNE ENTRÉE VIDE, PAS UN TABLEAU VIDE. macOS livre bash 3.2, où
  # `"${tableau[@]}"` sur un tableau vide échoue sous `set -u` (« unbound
  # variable »). La boucle saute l'entrée vide juste en dessous.
  A_SAISIR=( "" )
else
  echo "  jeton du CLI introuvable — il sera demandé à la saisie"
  A_SAISIR=( "SUPABASE_ACCESS_TOKEN|jeton personnel Supabase (dashboard → account → tokens)" )
fi

echo
echo "── À saisir ──"
for couple in \
  "${A_SAISIR[@]}" \
  "SUPABASE_DB_PASSWORD_DEV|mot de passe Postgres du projet DEV" \
  "SUPABASE_DB_PASSWORD_LIVE|mot de passe Postgres du projet LIVE"
do
  [ -z "$couple" ] && continue
  nom="${couple%%|*}"; aide="${couple#*|}"
  printf '  %s\n    %s\n    (Entrée seule pour passer) > ' "$nom" "$aide"
  read -rs valeur; echo
  poser "$nom" "$valeur"
  unset valeur
done

echo
echo "── Ce que le dépôt porte maintenant ──"
gh secret list
