# Déploiement

L'application vit dans `frontend/`. Le dépôt contient aussi `backend/`, qui ne se
déploie pas sur la même plateforme.

## Le réglage qui décide de tout

**Root Directory = `frontend`.**

C'est le seul réglage non évident, et son oubli produit une panne trompeuse : le
build échoue, la plateforme conserve le **dernier déploiement réussi**, et le
site paraît simplement « ne pas se mettre à jour ». Aucune erreur ne s'affiche
côté visiteur — l'ancienne version répond normalement, bugs compris.

Un script `build` a été ajouté à la racine pour que le dépôt compile même si le
Root Directory pointe sur la racine. Mais le réglage reste préférable : la
plateforme cherche le dossier de sortie `.next` à la racine du répertoire qu'on
lui désigne.

## Les variables d'environnement

| Variable | Sur le déploiement public |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **à ne PAS poser** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **à ne PAS poser** |
| `NEXT_PUBLIC_VERSION_EN_LIGNE` | `1` |

Les deux premières sont volontairement absentes : sans elles, l'application ne
porte **aucune clé d'accès** à une base contenant 30 829 personnes physiques.
C'est ce qui permet de rendre l'URL publique sans exposer de donnée. La lecture
de session (`lib/session.ts`) traite un environnement vide comme un visiteur non
identifié, donc l'accueil, le Job Board, le design system et les démonstrations
fonctionnent sans configuration.

`NEXT_PUBLIC_VERSION_EN_LIGNE=1` ouvre les vues qui sont fermées par défaut.
⚠️ Cette variable est **inlinée à la compilation** : la modifier exige un
redéploiement, pas seulement un redémarrage.

## Le middleware, et pourquoi il n'y en a plus

Voir `frontend/lib/session-refresh/README.md`. En résumé : un middleware
s'exécute sur chaque requête et dans le Edge Runtime ; une exception y fait
tomber le site entier en `MIDDLEWARE_INVOCATION_FAILED`, pas une page. Celui-ci
ne rafraîchissait qu'une session Supabase inexistante sur ce déploiement. Il est
retiré, documenté, et sa forme correcte est écrite pour le jour où
l'authentification sera branchée.

## Vérifier qu'un déploiement est bien le bon

Le piège est de regarder si le site répond. Il répond — c'est l'ancienne version.
Trois contrôles qui distinguent une version d'une autre :

```bash
U=https://pachamama-os.vercel.app
curl -s -o /dev/null -w '%{http_code}\n' $U/icon.svg      # 200 attendu
curl -s $U/ | grep -c "Découvrir l"                        # 1 attendu
curl -s -o /dev/null -w '%{http_code}\n' $U/demo/entreprise # 200 attendu
```

Un 404 sur `/icon.svg` signifie que le déploiement est antérieur au 19/08 22 h 35.
