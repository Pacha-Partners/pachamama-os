# Journal de bord — Pachamama OS

> Ce qui a été fait, dans quel ordre, et **pourquoi**. Les décisions
> structurantes vivent dans `docs/decisions/` ; ici on garde la trace du
> chemin, y compris des erreurs — elles expliquent des choix qui paraîtraient
> arbitraires sans elles.

---

## 19/08/2026 — La base talent unifiée existe

**Étape 1 achevée.** Le pivot n'est plus un fichier : c'est un PostgreSQL.

- Schéma dédié `pivot` : 8 tables, 18 index, 7 vues, **157 891 lignes**
- 30 829 talents · 33 546 liens sources · 24 365 emails · 11 428 téléphones
  6 092 qualifications · 5 714 attentes · 26 536 parcours · 19 381 notes
- Réconciliation fichier ↔ base : **écart nul** sur les volumes, l'identité des
  clés (diff d'ensembles) et le contenu champ par champ
- Audit de préséance contre la source : **0 violation** sur 136 replis
- Qualité des fusions : **99,83 %** de concordance, **0 faux positif du moteur**
- Sécurité : RLS sans policy + `security_invoker` sur les vues → la clé publique
  reçoit `permission denied for schema pivot`
- Dump livrable anonymisé, **restauré et validé** en base vierge (24 contrôles)

**Trois défauts trouvés en chemin, tous silencieux.** Consignés parce que le
mode de défaillance se reproduira ailleurs :

1. **Une vue contournait la RLS.** Une vue PostgreSQL s'exécute par défaut avec
   les droits de son propriétaire : elle aurait rouvert au web les 30 829
   talents que les tables protègent. `security_invoker` corrige.
2. **Le lecteur JSONL coupait des enregistrements.** Le `readline` de Node
   traite U+2028/U+2029 comme des fins de ligne ; le fichier, parfaitement
   valide, en contenait 21. Corrigé côté lecteur, jamais côté donnée.
3. **Une pagination tronquée en silence.** 13 073 notes écrites au lieu de
   19 381. La pagination lit désormais le total exact puis **échoue bruyamment**
   si elle ne l'atteint pas.

---

## 19/08/2026 — Choix de la stack et montage des environnements

**Stack arrêtée** — détail et justifications dans
`docs/decisions/0001-stack-technique.md`. Les trois propositions initiales
(Next.js, shadcn/ui, FastAPI, Supabase) ont été **conservées** après recherche :
rien de mieux n'a été trouvé. Ajouts limités à un besoin identifié chacun.

**Réorganisation en trois projets autonomes**, un langage par sous-arbre :
`backend/database` (SQL), `backend/pipeline` (Node), `backend/api` (Python),
`frontend` (Next.js). Workspaces npm écartés : ils résolvent le partage de code,
or ces projets ne partagent rien.

**Deux motifs critiques inscrits dans le code, pas dans une note :**

- *Le piège du pooler.* `asyncpg` et le pooler en mode transaction ne
  s'entendent pas : la connexion change et les *prepared statements*
  disparaissent. Désamorcé dans `db.py` — port 6543, aucun cache
  d'instruction, pas de pool client.
- *La RLS réelle.* `connexion_utilisateur()` ouvre une transaction, prend le
  rôle applicatif et injecte les claims vérifiés du jeton : c'est PostgreSQL qui
  arbitre. `connexion_service()` existe pour l'administration, et son docstring
  dit que l'employer pour servir un utilisateur est un défaut de conception.

**Deux erreurs de ma part, corrigées :**

- Les dossiers de vues avaient été nommés `(recruteur)`, `(entreprise)`… en
  croyant créer des URLs. Les parenthèses ne créent **pas** de segment : les
  cinq pages pointaient toutes sur `/` et le build aurait échoué sur un conflit
  de routes. Structure corrigée en `(prive)/recruteur/`, où le groupe porte le
  layout et le dossier porte l'URL.
- L'échafaudage initial visait Next.js 15 ; la version courante est **16.3**.

**Une bonne surprise sur l'authentification.** Le projet expose un **JWKS public
avec une clé ES256** : les jetons de session se vérifient par **clé publique**,
sans aucun secret à distribuer, et la rotation des clés est prise en charge en
amont. La vérification par secret partagé (HS256) reste en repli. C'est plus sûr
que ce qui était prévu, et ça supprime un secret de la chaîne.

**Vérification de bout en bout — les deux applications tournent :**

```
API        /sante        {"etat":"ok"}
           /sante/base   degradé (503) — DATABASE_URL à compléter
           /talents      401 sans jeton · 401 avec jeton forgé (refusé par JWKS)
           /docs         200

FRONT      /             307 → /connexion      (non connecté)
           /connexion    200
           /offres       200                   (public, seule vue indexable)
           /recruteur    307 → /connexion      garde-fou du layout privé
           /entreprise   307 → /connexion
           /talent       307 → /connexion
           /backoffice   307 → /connexion
           inexistante   404
           lang="fr" · titre correct · aucune erreur en journal
```

`npm run verifier` enchaîne tests base, lint et tests API, build frontend :
**tout vert**.

**Reste une valeur à fournir** : `DATABASE_URL` (Settings → Database →
Connection string → Transaction pooler, port 6543). Le mot de passe PostgreSQL
n'est pas dans les clés REST — il ne vit que dans le tableau de bord.

**Prochaine étape** : les features des quatre vues.

## 19/08/2026 — Design system de l'application

Construit à partir de trois sources ancrées, aucune inventée : le DS de marque
(Claude Design `844ac5af…`, porté **verbatim** dans `frontend/styles/brand/`),
l'export Figma de l'app (`frontend/Figma.md`) et 10 captures du DS applicatif.

Livré : `styles/app.css` (rampes violette et encre, cotes, ombres, rayons, les
11 classes typographiques), `app/globals.css` restructuré (imports → `@theme`
shadcn → correspondances de marque, **pas de mode sombre** : le DS n'en définit
aucun), `app/layout.tsx` (3 polices auto-hébergées via next/font), 10 composants
dans `components/pacha/`, 7 primitives shadcn thémées, et une page de référence
`/design-system` qui montre chaque élément dans ses états réels.

Vérifications : `npm run build` vert (9 routes), ESLint et `tsc --noEmit` sans
écart, page rendue et contrôlée en HTTP (60 Ko, jetons et polices présents dans
le CSS servi, 3 `.woff2` en 200).

Deux arbitrages motivés par la donnée et non par le goût, documentés dans
`app.css` : (a) `Body/Regular` et `Caption/Regular` en Abhaya Libre sont une
substitution accidentelle — le spécimen canonique les montre en sans et leurs
frères bold/highlight sont en Host Grotesk ; (b) `Roboto`, `M3/*`, `state-layer`
et `WF Base/*` viennent d'un sélecteur de date Material importé, donc exclus.

Réserves assumées et écrites : les rampes ne sont pas monotones (valeurs choisies
au cas par cas dans le Figma) — **non normalisées**, la maquette est la référence ;
les contrastes des tags de verticale ne sont pas mesurés ; `/design-system` est
hors `(prive)` le temps de la construction.

Documentation : `frontend/DESIGN_SYSTEM.md`.
