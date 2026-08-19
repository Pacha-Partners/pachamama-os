#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Assemble l'archive de rendu du projet annuel.
#
# Le point important est le choix de `git archive` plutôt qu'un `zip -r` :
# git archive n'embarque QUE les fichiers suivis par git. Il hérite donc
# intégralement du `.gitignore`, et avec lui de l'audit de sécurité :
#   — aucun fichier .env ne peut y entrer (seuls les .env.example sont suivis) ;
#   — aucune extraction de données ne peut y entrer (44 Mo + 19 Mo exclus) ;
#   — le fichier de revue interne des fusions, qui porte des noms de personnes
#     et d'employeurs réels, ne peut pas y entrer.
# Un `zip -r` du répertoire de travail, lui, aurait tout ramassé.
# ---------------------------------------------------------------------------
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RACINE"

SORTIE="${1:-$HOME/Desktop/MENYE_CLAUDE_CODE.zip}"
URL_APP="${URL_APP:-<à renseigner : URL Vercel>}"
URL_DEPOT="$(git remote get-url origin 2>/dev/null | sed 's/\.git$//' || echo '<dépôt git>')"

# Refus de travailler sur un arbre sale : l'archive doit correspondre à ce qui
# est poussé, sinon le lien du dépôt et l'archive divergent silencieusement.
if [[ -n "$(git status --porcelain)" ]]; then
  echo "⚠️  Des modifications ne sont pas committées. L'archive ne les contiendra PAS."
  git status --short | head -20
  # Ne demander confirmation que si un humain est là pour répondre : un
  # `read` sur une entrée non interactive bloque indéfiniment, ce qui rend le
  # script inutilisable en script ou dans un pipeline.
  if [[ -t 0 && "${FORCER:-0}" != "1" ]]; then
    read -r -p "Continuer quand même ? [o/N] " reponse
    [[ "$reponse" == "o" ]] || exit 1
  else
    echo "   (non interactif ou FORCER=1 : on continue sur le dernier commit)"
  fi
fi

TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT

echo "→ extraction des fichiers suivis par git…"
git archive --format=tar HEAD | (cd "$TEMP" && tar xf -)

# --- le fichier de liens, exigé par le guide -------------------------------
cat > "$TEMP/LIENS.md" <<EOF
# Liens du projet

| | |
|---|---|
| **Application déployée (URL publique)** | $URL_APP |
| **Dépôt git** | $URL_DEPOT |

## Ce qui est consultable sans aucun identifiant

| Vue | Chemin |
|---|---|
| Accueil et état d'avancement | \`/\` |
| Job Board public (seule vue indexée) | \`/offres\` |
| Design system — chaque composant dans chacun de ses états | \`/design-system\` |
| Démonstration — espace talent | \`/demo/talent\` |
| Démonstration — portail entreprise (suivi anonymisé) | \`/demo/entreprise\` |
| Démonstration — Chasseur de Talents (vue recruteur) | \`/demo/recruteur\` |

## Export SQL

\`backend/database/dump/pivot_dump.sql\` — schéma à l'identique et 400 talents
anonymisés (anonymisation déterministe, non réversible ; restauration vérifiée
par 24 contrôles, dont l'absence de donnée réelle).

## Identifiants

**Aucun n'est fourni, et c'est un choix motivé** : voir la section 5 du
\`README.md\`. La base de production porte 30 829 personnes physiques et aucune
base légale ne couvre la transmission de ses accès. Les routes \`/demo/*\` de
l'application déployée montrent les quatre vues sans aucun compte.
EOF

# --- contrôle de sûreté, avant de sceller ----------------------------------
echo "→ contrôle de sûreté de l'archive…"
FUITE=0
while IFS= read -r f; do
  case "$f" in
    *.env|*.env.local|*.env.production) echo "  ❌ secret : $f"; FUITE=1 ;;
    *.jsonl|*.csv)                      echo "  ❌ données : $f"; FUITE=1 ;;
    *revue_fusions.md)                  echo "  ❌ nominatif : $f"; FUITE=1 ;;
  esac
done < <(cd "$TEMP" && find . -type f)
[[ "$FUITE" -eq 0 ]] && echo "  ✅ aucun secret, aucune donnée personnelle" || { echo "ARCHIVE REFUSÉE."; exit 1; }

rm -f "$SORTIE"
(cd "$TEMP" && zip -q -r "$SORTIE" .)
echo "→ $SORTIE"
echo "  $(cd "$TEMP" && find . -type f | wc -l | tr -d ' ') fichiers · $(du -h "$SORTIE" | cut -f1)"
