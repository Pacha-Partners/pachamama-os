# Base talent unifiée — ce qui reste

> État au 25/08/2026, 07:00 UTC. Chaque chiffre est mesuré, pas estimé.
> Document de reprise : à relire avant de replonger dans la Phase 1.

## Où on en est

La base talent unifiée, c'est la **Tâche 5** du plan (`BDD_talent_unifiee_plan.md`).
T1 à T4 sont closes. T5 se découpe en deux : rendre le pivot **courant**
(il se remplit tout seul) et lui donner une **API d'accès**.

**Le pivot est vivant pour la source app.** 30 972 dorés, alimentés en continu :
97 exécutions du connecteur, une toutes les 15 minutes via n8n, curseur à jour.
Identité, contacts, notes (37 068), attentes (5 858) et qualification (6 621)
sont ingérés et idempotents.

**La source ATS ne tourne pas encore.** `pivot.sync_etat` la porte au statut
`jamais_lance`. Le code existe et est testé, il manque le premier chargement.

---

## 1. À FAIRE EN PREMIER — sécurité, ouvert depuis le 24/08

**Révoquer les droits d'exécution publics sur les fonctions RPC.**

Mesuré et re-vérifié le 25/08 : la clé `anon` — celle qui part dans le bundle du
navigateur de l'app déployée — atteint toujours `truncate_data_tables` et
`disable_fk`. Un GET renvoie 405 avec le code PostgreSQL 25006, ce qui signifie
que **le contrôle de droit est passé** et que seule la transaction en lecture
seule a bloqué l'appel. Un POST l'exécuterait.

`truncate_data_tables()` est en `SECURITY DEFINER` et fait un `TRUNCATE` de
toutes les tables de `public` après avoir supprimé les clés étrangères.

**Corrigé sur le dev le 26/08/2026, reste à appliquer en production.**
Le correctif est devenu une migration versionnée,
`supabase/migrations/20260826072934_revoquer_execution_publique.sql`, éprouvée sur
le projet de développement — qui portait la faille à l'identique. Avant / après
et les deux pièges rencontrés : **`docs/SECURITE_RPC.md`**.

Le script d'origine `Bubble migration/URGENT_revoquer_rpc_publiques.sql` est
**périmé** : sa troisième partie, censée protéger les fonctions futures, est sans
effet — `ALTER DEFAULT PRIVILEGES … REVOKE FROM PUBLIC` ne retire pas le droit
câblé de PostgreSQL. Mesuré. Ne pas l'utiliser.
Il ne touche aucune donnée, et le sync continue de fonctionner — il n'appelle
`finish_sync_type` qu'avec la clé de service, à laquelle le script accorde
explicitement le droit.

**Décision associée, à prendre en même temps** : rotation de la clé service_role,
qui a circulé dans les scripts d'exploitation du dossier de migration.

---

## 2. Le premier chargement Jarvi — le verrou de la source ATS

Tant que `sync_etat.curseur` de la source `ats` est vide, aucun run incrémental
n'est possible : le connecteur ne sait pas « depuis quand » lire, donc il lit
tout. **Le premier chargement est ce qui pose ce curseur.**

**Contrainte horaire.** La limite de débit de Jarvi ne s'applique que du lundi
au vendredi, 07:00 à 18:00 UTC : cinq minutes de temps d'exécution cumulé par
heure. Une lecture complète demande 268 requêtes, soit plus que le budget d'une
heure ouvrée. **Hors de cette plage — nuits et week-ends — aucune limite.**
Le connecteur refuse de lui-même une lecture complète en journée.

**Où on en est.** La comparaison exhaustive est à mi-chemin : 16 200 profils sur
26 724 lus et sauvegardés dans `var/connecteurs/comparaison_jarvi.json`. La
reprise repart de l'offset 16 200 — il reste 106 requêtes.

**Ce que la partie lue montre.** Sur les 16 200 profils les plus anciens,
**16 197 sont déjà dans le pivot** : le rapprochement par identifiant fonctionne
à 99,98 %. Le rattrapage sera donc essentiellement une **mise à jour** d'identité
avec préséance Jarvi, pas une création massive.

**Ce qui reste inconnu.** Les 10 524 profils non lus sont les plus **récents**,
donc les plus susceptibles d'être absents de l'export du 21 juillet. Le taux de
nouveaux mesuré sur la partie ancienne est un **plancher, pas une estimation**.
Et 10 492 liens du pivot ne sont pas couverts par la partie lue : mélange de
« dans les 10 524 restants » et de « n'est plus talent chez Jarvi ». Impossible
de les séparer avant d'avoir tout lu.

**Séquence :** finir la comparaison → simulation complète → écriture avec
manifeste de rollback. Le tout après 18:00 UTC ou le week-end.

---

## 3. Où tourne la synchro courante — décision à prendre

Une fois le curseur posé, un run incrémental coûte environ cinq requêtes. Trois
options, à trancher :

- **porter en JavaScript dans n8n**, comme pour l'app. Marche, mais recrée une
  quatrième copie du moteur d'inclusion — celle qu'on vient d'éliminer en
  extrayant `moteur.py` ;
- **attendre FastAPI**, et faire en sorte que n8n ne fasse qu'appeler un point
  d'entrée de l'API. Une seule implémentation. C'est la cible fixée ;
- **planifier le Python** sur une machine allumée. Simple, une implémentation,
  mais il faut la machine.

**Cadence recommandée : une fois par nuit.** Mesuré : 6 candidats modifiés en
24 h côté app, environ 800 profils par jour côté Jarvi. La cadence de 15 minutes
actuelle fait 96 exécutions quotidiennes pour traiter six changements. Et une
synchro nocturne fait **disparaître définitivement** la contrainte de quota
Jarvi, pas seulement pour le rattrapage.

⚠️ **Cette recommandation ne vaut que parce que rien ne lit le pivot aujourd'hui.**
Au jalon 3 de la Phase 2 — le portail entreprise — un décalage de 24 h deviendra
visible pour un client. Remonter la cadence à ce moment-là. C'est un réglage,
pas du code, mais personne ne s'en souviendra si ce n'est pas écrit.

---

## 4. L'API d'accès au pivot (T5-a)

Le squelette FastAPI existe : `backend/api/`, Python 3.12, configuration par
pydantic-settings, vérification de jeton par JWKS, mypy strict et ruff en règles
de sécurité. Restent les endpoints de lecture réels, la pagination, les filtres,
le contrat documenté et les tests contre un PostgreSQL réel.

**Deux tests échouent aujourd'hui** dans `tests/test_securite.py` —
`test_jeton_valide_est_accepte` et `test_le_role_ne_se_lit_jamais_dans_user_metadata`.
Vérifié : ils échouaient **avant** les travaux du 24/08, ce n'est pas une
régression. À traiter avec cette tâche.

---

## 5. Dettes acceptées, à solder quand l'occasion se présente

**`app_pivot.py` garde ses propres copies des fonctions du moteur.** L'extraction
dans `moteur.py` est faite et prouvée identique sur 3 000 fiches réelles, mais le
connecteur ne l'importe pas encore. Migration vérifiable par comparaison
avant/après ; à faire quand on touchera ce fichier pour une autre raison.

**`npm run api:lint` échoue : 175 erreurs mypy dans les connecteurs.** Mesuré
le 25/08/2026 — `app_pivot.py` 122, `jarvi_pivot.py` 21, `moteur.py` 20,
`annuler_run.py` 11, `jarvi.py` 1. Elles datent de l'entrée des connecteurs dans
`src/` le 24/08 : ils n'avaient jamais été soumis à mypy, alors que le script
`api:lint` couvre tout `src`. Vérifié que ce n'est pas une régression — le
compte est identique avant et après les travaux du 25/08, et `commun.py` n'en
porte aucune. Conséquence pratique : `npm run verifier` s'arrête là.
L'essentiel est du typage manquant sur des fonctions internes, pas des erreurs
de logique. À solder quand on touchera ces fichiers pour une autre raison.

**Le nœud n8n est un portage JavaScript**, donc une seconde implémentation. La
règle de non-divergence est écrite dans `connecteurs/__init__.py` : toute
correction se fait dans le Python d'abord, puis se reporte. Le nœud disparaîtra
quand l'API sera déployée.

**Attentes et qualification restent partielles** côté app : le miroir a perdu les
champs d'enrichissement de la table `experience` (Product, Profile, Expertises,
Background). À récupérer par une re-synchronisation Bubble → miroir, chantier
distinct.

**`pivot.conflit` est append-only.** Un rejeu forcé (`--plein`) réinscrit les
conflits. En fonctionnement normal le curseur fait que chaque fiche n'est traitée
qu'une fois. Déduplication possible, non faite.

**Six mille deux cents fantômes dans le miroir** — des fiches présentes côté
miroir, absentes de Bubble. Dont 5 540 notes qui sont des **doublons d'archives**
(contenu préservé dans `note_archivee`, appariement bijectif vérifié). La
décision est prise et documentée dans `Bubble migration/RECONCILIATION_ET_FANTOMES.md` :
purge dure différenciée, après réconciliation périodique. Parqué — le pivot les
filtre déjà, ça ne bloque rien.

**Cent quinze fiches périmées hors d'atteinte** dans le miroir, sur des types en
statut `ok`. Dégâts de mai-juin, antérieurs aux travaux du 24/08. Demandent un
rejeu explicite par identifiant.

---

## Ce qui n'est pas dans cette phase

La restitution pivot → producteurs (écriture vers Jarvi ou vers l'app) est **hors
périmètre**, décision du 24/08 : ingestion seule. Tout le monde alimente le
pivot, le pivot devient la source de lecture.
