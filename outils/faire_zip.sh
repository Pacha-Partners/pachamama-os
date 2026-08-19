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

# --- le document d'accompagnement, exigé par le guide ----------------------
#
# Il est GÉNÉRÉ ICI et jamais committé : il porte les mots de passe des comptes
# de démonstration, et le dépôt est public. Les identifiants sont lus depuis
# IDENTIFIANTS_DEMO.md, qui est exclu par .gitignore et ne quitte donc pas cette
# machine autrement que par cette archive.
IDENTIFIANTS="$RACINE/IDENTIFIANTS_DEMO.md"

{
  cat <<EOF
# Pachamama OS — accès et liens

Projet annuel · Bachelor Data & Business Intelligence
Titre professionnel « Chef de projet web » (RNCP40857) · NEXA Digital School Lyon
Apprenant : **Claude Menye** · août 2026

---

## 1. Les deux liens

| | |
|---|---|
| **Application en ligne (version de démonstration)** | $URL_APP |
| **Dépôt du code source** | $URL_DEPOT |

**Commencez par l'application en ligne.** C'est la version vivante du projet, et
elle ne demande aucun identifiant pour l'essentiel de ce qu'il y a à voir.

### Ce qui est consultable sans aucun compte

| Vue | Chemin |
|---|---|
| Écran d'accueil et de connexion | \\`/\\` |
| **Design system** : les 25 composants de l'interface, chacun dans tous ses états | \\`/design-system\\` |
| Job Board public, la seule vue destinée à être indexée | \\`/offres\\` |
| Fiche d'une offre | \\`/offres/<identifiant>\\` |
| Point d'entrée de la démonstration | \\`/demo\\` |
| Démonstration de l'espace talent | \\`/demo/talent\\` |

> Selon l'avancement du déploiement, certaines de ces routes peuvent renvoyer
> vers l'accueil : le régime d'ouverture est piloté par une variable
> d'environnement, volontairement fermée par défaut. \\`/\\` et
> \\`/design-system\\` sont accessibles en toutes circonstances.

---

## 2. Pourquoi le code livré ne peut pas être exécuté contre les données réelles

C'est une décision, pas une omission.

La base de production réunit **30 829 personnes physiques** : des candidats
réels, avec leurs coordonnées, leurs prétentions et les notes prises par les
recruteurs. Transmettre les clés d'accès à cette base serait une communication de
données personnelles sans base légale.

Le code de cette archive documente donc les variables d'environnement attendues
(\\`*.env.example\\`) **sans leurs valeurs**. Il démarre néanmoins sans aucune
configuration : la lecture de session traite un environnement vide comme un
visiteur non identifié, ce qui laisse l'accueil, le Job Board, le design system
et les démonstrations parfaitement fonctionnels en local.

Pour obtenir une base **peuplée et sans donnée personnelle**, l'archive contient
un export SQL anonymisé : voir la section 4.

---

## 3. Les comptes de démonstration

EOF

  if [[ -f "$IDENTIFIANTS" ]]; then
    # On retire l'avertissement interne de non-versionnement, sans intérêt ici,
    # et on reprend le reste tel quel : procédure de création comprise.
    sed '/^> ⚠️ \*\*CE FICHIER/,/^$/d; /^# Identifiants de démonstration/d' "$IDENTIFIANTS"
  else
    echo "⚠️ \`IDENTIFIANTS_DEMO.md\` absent de la machine de génération :"
    echo "les comptes de démonstration n'ont pas pu être repris dans ce document."
  fi

  cat <<EOF

### Un point d'honnêteté sur ces comptes

Ces identifiants sont **préparés**, pas encore actifs : les comptes doivent être
créés dans le fournisseur d'authentification selon la procédure ci-dessus, et le
déploiement public ne porte volontairement aucune clé d'accès à la base.

Cela ne limite pas l'évaluation : **les routes \\`/demo/*\\` de l'application en
ligne montrent les vues sans aucun compte**, et c'est par elles qu'il faut
passer. Les comptes servent la version connectée, qui lit la base réelle.

Précision utile : même actifs, ces comptes ne donneraient accès à **aucune
donnée**. Le schéma \\`pivot\\` a la sécurité au niveau des lignes activée
**sans aucune policy**, donc il refuse par défaut. C'est aussi ce qui rend ces
identifiants sûrs à transmettre.

---

## 4. L'export SQL

\\`backend/database/dump/pivot_dump.sql\\`

Schéma **à l'identique** et **400 talents anonymisés**. L'anonymisation est
déterministe (dérivée d'un hachage de l'identifiant) donc reproductible, et
**non réversible**. Sa restauration en base vierge est vérifiée par 24 contrôles,
dont l'absence de donnée réelle.

\\`\\`\\`bash
psql "\\$DATABASE_URL" -f backend/database/dump/pivot_dump.sql
\\`\\`\\`

---

## 5. Par où entrer dans le code

| Ce que vous cherchez | Où |
|---|---|
| Installation, prérequis, scripts | \\`README.md\\` |
| Décisions d'architecture, datées et justifiées | \\`docs/decisions/\\` |
| Journal de bord du projet | \\`docs/journal.md\\` |
| Le schéma de la base pivot | \\`backend/database/schema/01_schema_pivot.sql\\` |
| Les vues de contrôle qualité | \\`backend/database/schema/02_vues_qualite.sql\\` |
| Le pipeline de réconciliation et les audits | \\`backend/pipeline/\\` |
| L'application des droits côté API | \\`backend/api/src/pachamama_api/db.py\\` |
| Le design system | \\`frontend/components/pacha/\\` et \\`frontend/DESIGN_SYSTEM.md\\` |

---

## 6. Ce que cette archive ne contient pas

- **Aucune donnée personnelle.** Les extractions de travail et le fichier de
  revue interne des fusions, qui portent des noms de personnes et d'employeurs
  réels, sont exclus. Le seul jeu de données présent est l'export anonymisé.
- **Aucun secret.** Les fichiers d'environnement sont exclus ; seuls les
  \\`.env.example\\` sont présents.
- **Aucun nom de client.** Les données de démonstration de l'interface sont
  fictives.

L'archive est produite par \\`git archive\\`, qui n'embarque que les fichiers
suivis par le dépôt : elle hérite donc mécaniquement de ces exclusions, plutôt
que de dépendre d'une vérification manuelle.
EOF
} > "$TEMP/ACCES.md"

# --- contrôle de sûreté, avant de sceller ----------------------------------
echo "→ contrôle de sûreté de l'archive…"
FUITE=0
while IFS= read -r f; do
  case "$f" in
    *.env|*.env.local|*.env.production) echo "  ❌ secret : $f"; FUITE=1 ;;
    *.jsonl|*.csv)                      echo "  ❌ données : $f"; FUITE=1 ;;
    *revue_fusions.md)                  echo "  ❌ nominatif : $f"; FUITE=1 ;;
    ./ACCES.md)                         echo "  ℹ️  document d'accompagnement (contient les comptes de démonstration)" ;;
  esac
done < <(cd "$TEMP" && find . -type f)
[[ "$FUITE" -eq 0 ]] && echo "  ✅ aucun secret, aucune donnée personnelle" || { echo "ARCHIVE REFUSÉE."; exit 1; }

rm -f "$SORTIE"
(cd "$TEMP" && zip -q -r "$SORTIE" .)
echo "→ $SORTIE"
echo "  $(cd "$TEMP" && find . -type f | wc -l | tr -d ' ') fichiers · $(du -h "$SORTIE" | cut -f1)"
