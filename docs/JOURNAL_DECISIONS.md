# Journal des décisions — construction des portails

> Ouvert le 09/09/2026. Chaque décision prise **sans arbitrage humain**, pendant la construction
> autonome des portails Entreprise, Talent et de la tranche Recruteur, est consignée ici : ce que
> j'ai décidé, ce que j'ai écarté, pourquoi, et ce que ça coûte.
>
> Mandat reçu : travailler plusieurs heures en autonomie, décider de tout, viser zéro bug, ne pas
> interrompre pour demander. Le design system existant est **non négociable** ; y ajouter des
> éléments est autorisé.
>
> **Convention** : chaque décision porte un identifiant `D-nn`, une date, un statut
> (`appliquée` / `en cours` / `annulée`), et une ligne « ce que ça coûte » — parce qu'aucune
> décision n'est gratuite et que celle qui prétend l'être cache son prix.

---

## D-01 — Par où passent les écritures : fonctions `api.*` en SECURITY INVOKER

**Date** : 09/09/2026 · **Statut** : appliquée · **Amende l'ADR 0001**

### Le problème
Il n'existe aujourd'hui **aucun chemin d'écriture** dans l'application. Aucune vue `api` n'est
auto-updatable (toutes portent des jointures ou des sous-requêtes) ; `frontend/lib/api.ts` définit
`appelApi()` qui n'est **appelée nulle part**. Les seules écritures du dépôt sont `signInWithPassword`
et `signOut`. Il faut choisir, et le choix détermine la forme de tous les formulaires à venir.

### Les trois voies

| | A — API FastAPI | B — Écriture directe Supabase | **C — Fonctions `api.*` INVOKER** |
|---|---|---|---|
| Conforme à l'ADR 0001 | oui, littéralement | non | **non littéralement, oui en intention** |
| Journal + idempotence | naturels | par déclencheurs, auteur difficile à porter | **naturels, dans la fonction** |
| Liste blanche de colonnes | explicite | `GRANT UPDATE (col…)` dispersé sur 81 colonnes | **explicite** |
| Qui arbitre le cloisonnement | le code Python | PostgreSQL | **PostgreSQL** (INVOKER ⇒ la RLS s'applique) |
| Coût d'amorçage | **élevé** : `backend/api` est câblé sur `pivot`, `npm run api:lint` échoue déjà sur 175 erreurs mypy et 2 tests de sécurité | faible | **faible** |
| Service à déployer | un de plus | aucun | aucun |

### La décision
**C.** Toute écriture passe par une fonction `api.<verbe>_<objet>(...)` déclarée
`security invoker`, appelée depuis une Server Action Next.js avec le jeton de l'utilisateur.
Chaque fonction : valide ses arguments, n'écrit que des colonnes explicitement nommées, inscrit une
ligne dans `app.journal_ecriture`, et honore `app.idempotence`. Les lectures restent en direct
Supabase, comme aujourd'hui.

### Pourquoi pas A
L'ADR 0001 dit « écritures toujours par l'API ». Son intention est claire : ne pas laisser un client
web écrire n'importe quoi n'importe où. C'est exactement ce que C garantit. Mais A impose d'abord de
remettre d'aplomb un backend Python qui ne compile pas au lint et qui ne connaît pas le schéma `core` —
un chantier avant le premier écran. Face à un mandat « plusieurs heures, zéro bug », engager d'abord un
portage de service est le plus sûr moyen de ne livrer aucun portail.

### Pourquoi pas B
Parce que `talent_maj_sa_fiche` autorise aujourd'hui un talent à réécrire `est_qualifie`,
`statut_relation`, `agent_referent_id` et `seniorite` — la qualification que le cabinet porte **sur
lui**. Une policy RLS choisit des lignes, jamais des colonnes. B laisserait ce trou ouvert.

### Pourquoi INVOKER et pas DEFINER
Le projet a déjà payé l'oracle `api.masquer_client` : une fonction DEFINER exécutable par `anon`
répondait « ce nom est-il celui du client ? ». La règle écrite depuis est que **PostgreSQL arbitre**.
En INVOKER, la RLS de l'appelant s'applique à l'intérieur de la fonction : le cloisonnement ne dépend
pas de ce que la fonction pense faire. La contrepartie est qu'il faut ouvrir des policies d'écriture
et des `GRANT` par colonne — c'est le travail, et c'est le bon.

### Ce que ça coûte
Un amendement écrit à l'ADR 0001 (`docs/decisions/0005-chemin-ecriture.md`). Des policies d'écriture
à poser portail par portail. Et le jour où une écriture devra appeler un service tiers (signature
électronique, parsing de CV), il faudra un vrai serveur : C ne couvre que les écritures qui restent
dans PostgreSQL. C'est assumé — aucune des features `must` des trois portails n'en sort.

---

## D-02 — Les 14 libellés d'étape, en trois registres

**Date** : 09/09/2026 · **Statut** : appliquée

### Le problème
`ref.etape_process` porte trois registres : `libelle_interne` (peuplé), `libelle_client` (NULL),
`libelle_talent` (NULL). La table source Bubble est **détruite** — 70 lignes contenant chacune un
caractère isolé. Le contenu public est définitivement perdu. Les vues replient sur l'interne : un
client et un candidat lisent aujourd'hui **« 🙅🏻‍♀️ KO by Pachamama »**.

### La décision

| ordre | interne (conservé) | **registre client** | **registre talent** |
|---|---|---|---|
| 1 | 📩 To contact | *(invisible)* | Candidature reçue |
| 2 | 📨 Contacted | *(invisible)* | Premier échange |
| 3 | ⚡️ Applicant | *(invisible)* | Candidature reçue |
| 4 | *(sans libellé, 2 lignes)* | *(invisible)* | Candidature reçue |
| 5 | 🎤 Screen Pachamama | *(invisible)* | Entretien Pachamama |
| 6 | 👌 Send-out | Profil présenté | Profil transmis au client |
| 7 | 🎤 Interview 1 | Premier entretien | Premier entretien client |
| 8 | 🎤 Interview 2 | Deuxième entretien | Deuxième entretien client |
| 9 | 🎙️ Final interview | Entretien final | Entretien final |
| 10 | 🙌 Hired | Recruté·e | Recruté·e |
| 11 | 🙅🏻‍♀️ KO | Écarté·e | Candidature close |
| 12 | 🙅🏻‍♀️ KO by Pachamama | *(invisible)* | Candidature close |
| 13 | 🙅🏻‍♀️ KO by client | Écarté·e par vos soins | Candidature close |
| 14 | 🙅🏻‍♀️ KO by candidat | Retiré·e par le candidat | Candidature retirée |

### Les deux partis pris
**Le français, et pas d'anglais.** Le registre interne reste tel quel — c'est le vocabulaire de
l'équipe, il fonctionne. Les registres publics sont en français parce que ce sont des surfaces
clientes et candidates.

**Côté talent, les trois variantes de KO se replient sur « Candidature close ».** Dire à quelqu'un
« écarté par Pachamama » plutôt que « écarté par le client » est une information qui l'expose sans
l'aider, et qui engage le cabinet dans la relation. La forme neutre est la seule qui ne nuise pas.
Le motif détaillé reste disponible en interne et transmissible à la main.

### Ce que ça coûte
Ces libellés sont mon invention, pas une restauration. Si le vocabulaire d'origine réapparaît un jour
(export Bubble antérieur à la destruction), il faudra les confronter.

---

## D-03 — Ce qu'un client voit du pipeline : à partir du send-out, et rien avant

**Date** : 09/09/2026 · **Statut** : appliquée

### La décision
`visible_client = true` sur **six étapes seulement** : Send-out, Interview 1, Interview 2, Final
interview, Hired, et KO by client. `false` partout ailleurs — y compris sur les deux KO
« by Pachamama » et « by candidat », et sur les quatre étapes d'amont.

### Pourquoi
Le ticket J3 prescrit « les étapes antérieures au send-out renvoient zéro ligne ». La règle d'usage
inscrite au modèle est « tant que `visible_client` est NULL, traiter comme non visible — fermeture par
défaut » ; le SQL actuel fait exactement l'inverse. `KO by client` est visible parce que le client est
l'auteur de cette décision : la lui cacher serait absurde.

### La limite, assumée
Un candidat **présenté puis écarté par Pachamama** disparaît de la vue du client, alors qu'il l'avait
vu. La raison est mesurable : **`app.transition_etape` est vide et l'historique d'étapes n'existe nulle
part** (les colonnes sources du miroir sont vides à 100 %) — rien ne permet de savoir si une
candidature aujourd'hui en KO est passée par le send-out.

Correctif posé pour l'avenir : une colonne `core.candidature.presente_le`, écrite au moment de la
transition vers Send-out. Elle démarre vide et se remplira d'elle-même. Quand elle aura de la matière,
le filtre deviendra « présentée un jour » plutôt que « à une étape visible ».

---

## D-04 — La visibilité d'une note : deux booléens, fermés par défaut

**Date** : 09/09/2026 · **Statut** : appliquée

### Le problème
`core.note` porte 45 685 lignes et **aucune colonne de visibilité**. Trois features en dépendent
(notes partagées en lecture côté client, commentaires libres du client, fil d'échange avec l'AM), et
aucune ne peut exister sans distinguer une note interne d'une note partagée.

### La décision
Deux colonnes : `visible_client boolean not null default false` et
`visible_talent boolean not null default false`.

Écarté : un énuméré `visibilite (interne|client|talent)`. Une note peut légitimement être partagée
avec le client **et** avec le candidat (un compte rendu d'entretien, par exemple) ; un énuméré à valeur
unique l'interdirait, et l'élargir plus tard coûte un `ALTER TYPE` qui ne peut pas être suivi d'un usage
dans la même transaction — piège déjà rencontré sur ce projet.

**Les 45 685 notes existantes restent internes.** Aucun backfill : ces notes ont été écrites sans que
personne n'envisage qu'un client les lise. Les ouvrir rétroactivement serait la pire des décisions
silencieuses.

---

## D-05 — `ref.motif_ko` : un référentiel, pas un texte libre

**Date** : 09/09/2026 · **Statut** : appliquée

### Le problème
6 285 candidatures sur 7 236 sont en KO, et **aucune colonne ne dit pourquoi**.
`candidature.motif_ko_code` est un `text` sans référentiel ni FK — le commentaire de la migration
d'origine dit lui-même « à créer ». L'ADR 0002 impose que les motifs de KO soient **structurés et
journalisés de façon exploitable**, parce que le Chasseur s'en nourrira.

### La décision
Créer `ref.motif_ko (code, libelle, categorie, actif, ordre)` avec trois catégories alignées sur les
trois étapes de KO déjà présentes — `pachamama`, `client`, `candidat` — et poser la FK depuis
`core.candidature.motif_ko_code`. Les 6 285 KO historiques restent sans motif : la donnée n'existe
pas, l'inventer serait pire que l'absence.

Le référentiel démarre avec les motifs que le funnel rend inévitables (compétences, séniorité,
rémunération, localisation/remote, disponibilité, contre-offre, désistement, poste pourvu autrement,
poste annulé, sans réponse). Il est **ouvert** : `ref.metier` a montré qu'un vocabulaire métier grandit.

---

## D-06 — Segmenter les droits du schéma `api`, vue par vue et portail par portail

**Date** : 09/09/2026 · **Statut** : appliquée

### Trois fuites, mesurées et non déduites
Sondées le 09/09 avec de vrais jetons des comptes de `COMPTES_DE_TEST.md` :

1. **Un compte talent lit le nom réel des clients.** `api.mandat_client` rend 12 lignes à un talent
   (policy `talent_offres_publiees`) et projette `titre`, qui est **interne** :
   `"SantéVet - Lead PM"`, `"N2J Soft - Product Manager"`. Or **11 des 12 offres publiées sont
   anonymes** sur le job board. C'est l'incident `v_fuite_client` rouvert par une autre porte.
2. **Un compte entreprise lit les prétentions salariales des candidats.** `api.kanban` rend 26, 93 et
   223 lignes aux trois comptes clients de test, avec `pretention_ke` renseigné et le libellé d'étape
   **interne**. Le ticket J3 interdit explicitement les deux.
3. **Un compte talent atteint `api.talent_recherche`** et y lit sa propre fiche telle que le cabinet
   la qualifie : `est_qualifie`, `statut_relation`, `mindset`, le prénom de son `referent`. C'est
   exactement ce que `api.ma_fiche` avait été conçue pour ne pas montrer.

### La cause
`grant select on all tables in schema api to authenticated` + `alter default privileges`. La migration
qui l'a posé le dit elle-même : « toute vue qu'on y crée est lisible par tout compte connecté sans rien
demander ». Trois vues ont été refermées à la main après coup ; les vues métier ne l'ont jamais été.

### La décision
Révoquer le grant global et accorder **vue par vue, portail par portail**. Une vue nouvelle naît donc
inaccessible — c'est l'inverse du défaut actuel, et c'est la posture que le reste du modèle a déjà
adoptée (RLS activée sans policy).

| vue | talent | entreprise | recruteur | backoffice |
|---|---|---|---|---|
| `moi`, `offre_publique`, `offre_detail` | ✓ | ✓ | ✓ | ✓ |
| `ma_fiche`, `ma_candidature` | ✓ | — | — | — |
| `mandat_client`, `candidature_client` | — | ✓ | — | — |
| `kanban`, `talent_recherche` | — | — | ✓ | ✓ |

`offre_publique` et `offre_detail` restent ouvertes à `anon` — c'est le job board.

En complément : **`titre` sort de `api.mandat_client` et de `api.ma_candidature`**, remplacé par un
libellé public construit comme celui de `offre_publique`. Une colonne interne n'a rien à faire dans une
vue exposée, quel que soit le portail : la refermer par les droits ne suffit pas, il faut ne pas la
construire.

---

## D-07 — Le RGPD est instruit côté produit, pas côté juridique

**Date** : 09/09/2026 · **Statut** : appliquée

Le cadrage RGPD est déclaré **bloquant avant toute mise en production**, et il n'est pas instruit. Ce
n'est pas une décision technique : base légale des profils issus du seul ATS, statut du fournisseur,
politique de rétention, registre des traitements — cela appartient au dirigeant.

**Ce que je fais quand même** : les écrans et les mécanismes `must` du portail talent (consentement
explicite, export de ses données, demande de suppression, drapeau `actif`) sont construits et branchés
sur `consentement_donne_le` et `anonymise_le`, qui existent déjà et ne sont jamais écrits. Le produit
sera prêt ; l'autorisation de l'ouvrir reste une décision humaine.

---

## D-08 — Les primitives d'interface manquantes entrent dans le design system

**Date** : 09/09/2026 · **Statut** : appliquée

Le DS compte 28 composants et couvre le job board. Il ne couvre pas l'applicatif : ni tableau de
données, ni pagination, ni onglets, ni dialogue desktop, ni toast, ni squelette de chargement, ni état
d'erreur de page, ni `<textarea>`, ni téléversement, ni menu d'actions, ni fil de commentaires, ni
frise chronologique, ni kanban. `Feuille` est un *bottom sheet* mobile ; `Menu` est la navigation
latérale, pas un menu d'actions.

**Décision** : les créer dans `frontend/components/pacha/`, dans la langue et la forme du DS existant
(nommage français, jetons `--r-*` / `--encre-*` / `--ombre-*`, classes `.t-*`, pas de mode sombre), et
les ajouter à la vitrine `/design-system`. Aucun composant existant n'est modifié dans son contrat :
le DS présent est non négociable, on l'étend.

`@tanstack/react-table` et `@tanstack/react-virtual` sont **déjà installés et importés nulle part** —
le tableau s'appuiera dessus plutôt que d'ajouter une dépendance.

---

## D-09 — Le pseudonyme est unique dans son mandat, pas dans la base

**Date** : 09/09/2026 · **Statut** : appliquée · **Corrige D-03**

La base m'a arrêté : `candidature_pseudo_unique` était un index unique **global**
sur `reference_pseudonyme`. Posé quand la colonne était vide, jamais éprouvé, il a sauté
sur « #001 » dès la première tentative de remplissage.

**Décision** : l'unicité descend au couple `(mandat_id, reference_pseudonyme)`, avec
`nulls not distinct` pour que deux candidatures sans mandat ne puissent pas porter le
même numéro. Une numérotation globale aurait donné « #4271 » — illisible au téléphone, et
révélant au passage la taille du vivier et l'ancienneté relative d'un candidat. Un
pseudonyme n'a de sens que dans le périmètre où il est employé.

**Erreur commise et corrigée** : j'ai d'abord créé l'index **avant** le remplissage. Avec
`nulls not distinct`, les 7 236 lignes encore vides collisionnent entre elles. L'ordre est
donc : libérer l'ancien index → remplir → NOT NULL → créer le nouvel index.

---

## D-10 — Un `GRANT` ne peut pas cloisonner par portail

**Date** : 09/09/2026 · **Statut** : appliquée · **Corrige D-06**

D-06 annonçait un cloisonnement « vue par vue, portail par portail » par les droits.
**C'est impossible** : tous les comptes, quel que soit leur portail, partagent le même rôle
PostgreSQL `authenticated`. Il n'existe pas de rôle par portail, et il ne peut pas y en avoir
sans réécrire l'authentification.

**Décision** : le garde-fou descend dans le `WHERE` des vues — `api.a_portail('entreprise')`,
`api.a_portail('recruteur') or api.a_portail('backoffice')`. Les vues sont en
`security_invoker` et la fonction est `stable` : le planificateur l'évalue une fois par
requête, pas une fois par ligne.

Ce qui reste du plan initial : la clause `alter default privileges … grant select` est
**retirée**, pour qu'une vue future naisse fermée au lieu de naître ouverte.

**Mesure après correctif** — un compte talent rend désormais 0 ligne sur `mandat_client`,
`candidature_client`, `kanban` et `talent_recherche` ; un compte entreprise rend 0 sur
`kanban` et `talent_recherche` ; le job board public sert toujours ses 12 offres.

---

## D-11 — Les vues cloisonnées restent auditables par la clé de service

**Date** : 09/09/2026 · **Statut** : appliquée

La garde de D-10 ferme aussi la vue à `service_role` — `auth.uid()` est nul, donc
`api.compte_id()` l'est, donc la garde est fausse. Or la définition de « fini » d'un jalon
exige un test qui **compare le résultat sous jeton utilisateur au résultat sous clé de
service**. Sans référence, il n'y a plus de comparaison.

**Décision** : une fonction `api.est_service()` lit le rôle du jeton, et chaque garde devient
`(select api.est_service()) or <garde de portail>`. Ce n'est pas une réouverture :
`service_role` contourne déjà la RLS et lit les tables de `core` directement. On lui rend la
**vue**, pour que l'audit porte sur l'objet qu'on veut auditer.

---

## D-12 — Trois policies manquantes, trouvées par la mesure et non par la lecture

**Date** : 09/09/2026 · **Statut** : appliquée

Trois jointures rendaient NULL en silence. **Un LEFT JOIN sur une table fermée par RLS ne
lève pas d'erreur : il rend NULL.** C'est le mode d'échec le plus traître de ce modèle, et
il s'est produit trois fois dans la même journée.

| Symptôme | Cause | Correctif |
|---|---|---|
| Un talent lit « Poste » au lieu de l'intitulé de l'offre | La seule policy talent sur `core.mandat` n'ouvre que les **12 mandats publiés** ; ses candidatures portent sur d'autres | `talent_mandats_de_ses_candidatures` |
| Le nom du client n'apparaît jamais côté talent | Aucune policy talent sur `core.entreprise` | `talent_entreprises_de_ses_candidatures`, **restreinte aux offres non anonymes** |
| `agent_nom` est NULL sur les 7 mandats du client de test | Aucune policy client sur `core.collaborateur` | `client_ses_agents` + `talent_son_agent` |

**Récursion, et sa réponse** : la première version de la policy sur `core.mandat` interrogeait
`core.candidature`, dont la policy interroge `core.mandat` → `42P17, infinite recursion`.
Le projet avait déjà la réponse — `api.mes_entreprises()` est `security definer` pour cette
raison exacte. Trois fonctions DEFINER de même nature ont été ajoutées :
`api.mes_mandats_talent()`, `api.mes_entreprises_talent()`, `api.mes_agents_client()`.
C'est la seule raison légitime d'un DEFINER ici : **rompre le cycle, pas élargir un droit** —
aucune ne rend quoi que ce soit que le compte ne possède déjà.

**Deuxième barrière sur l'anonymat** : `api.mes_entreprises_talent()` exclut les mandats
anonymes, alors que la vue les masque déjà. Sur ce projet, l'anonymat d'une offre a fui deux
fois : une seule barrière ne suffit pas.

---

## D-13 — Ce que la règle de visibilité coûte réellement, mesuré

**Date** : 09/09/2026 · **Statut** : constat, appliquée

Après application de D-03, sur les 7 206 candidatures :

| | |
|---|---|
| **visibles par le client** | **1 893 — 26,3 %** |
| masquées | 5 313 |

Le détail : `ko_by_pachamama` 4 302 (masquée), `ko_by_client` 1 470 (visible), `hired` 235,
`send_out` 86, `interview_1` 48, `interview_2` 45, `final_interview` 9.

Un quart du pipeline reste visible : la règle ne vide pas le portail. Mais la répartition
est très inégale d'un client à l'autre — le compte de test Hublo ne voit que 2 de ses 26
candidatures, parce que ses mandats sont clos et que ses pertes sont presque toutes
antérieures au send-out. **C'est l'état honnête de la donnée, pas un défaut d'affichage** :
l'écran devra le dire plutôt que de sembler vide.

---

# PHASE 1 — PORTAIL ENTREPRISE

Squad : 1 designer (13 primitives de design system), 1 développeur base (11 migrations,
6 vues, 9 fonctions d'écriture), 1 développeur écrans (6 routes), 1 correcteur.
Puis vérification et corrections par moi.

---

## D-14 — Le candidat présenté porte un nom ; la liste, une référence

**Date** : 09/09/2026 · **Statut** : appliquée · **Migration** `20260912110000`

### Ce que la revue a trouvé
`api.candidat_presente` projetait `prenom` et `cv_url`, et l'écran faisait du second un bouton
« Ouvrir le CV ». Or `core.fiche_talent.cv_url` porte le nom **dans le chemin du fichier** :

```
…/2025-09-22_MALAKH Sarah_CV_EN_Pachamama.pdf
…/CV-Fr-Nicolas-Lerolle.pdf
```

**Mesuré moi-même** sur les 1 893 candidatures visibles d'un client : 1 414 portent un `cv_url`,
dont **1 145 — 81 % — contiennent un patronyme du vivier**. Le nom partait dans le HTML servi,
sans même un clic. 1 683 portent en plus une `photo_url`.

### Pourquoi je n'ai pas colmaté
Le correcteur concluait « retirer `cv_url` ou assumer ». Il raisonnait sur une prémisse que le
cadrage ne pose pas. Le cadrage P0 décrit cette feature mot pour mot :

> « Fiche candidat présentée (profil contrôlé) — Vue d'un candidat shortlisté : **prénom/nom**
> (ou anonymisé selon étape), **photo, CV**, expériences, métier actuel, anglais, prétentions,
> **sans les notes internes ni l'avis Pachamama**. »

Le garde-fou nommé par le métier porte sur **l'avis**, pas sur l'identité. Un client qui reçoit un
profil va rencontrer cette personne. Lui cacher son nom tout en lui envoyant son CV, c'est le pire
des deux mondes : on ne protège rien, et on fuit par accident au lieu de divulguer par décision.

### La règle
| surface | ce qu'elle montre |
|---|---|
| **Liste et kanban** | la référence pseudonyme, **seule** |
| **Fiche d'un candidat présenté** | prénom, **nom**, photo, CV, parcours, attentes |

Il n'existe aucune étape où le client verrait un candidat sans droit de savoir qui : la visibilité
commence au send-out, et un send-out **est** l'acte de présenter la personne.

**Reste interdit, et n'a pas bougé** : e-mail, téléphone, LinkedIn — on joint quelqu'un par le
cabinet, c'est le métier — les six colonnes de jugement de la candidature, et toute la
qualification cabinet.

### Ce que ça coûte
Transmettre le CV d'une personne à un client relève du **consentement**.
`core.fiche_talent.consentement_donne_le` existe et n'est écrite nulle part. C'est le chantier de
la phase Talent, et le cadrage RGPD reste déclaré bloquant avant toute mise en production.
L'écran le dit désormais au client : *« Ce profil vous est communiqué pour ce recrutement. »*

---

## D-15 — Une colonne sélectionnée part dans le HTML, même si rien ne l'affiche

**Date** : 09/09/2026 · **Statut** : appliquée · **La leçon la plus utile de cette phase**

Après D-14, mon contrôle indépendant a trouvé le nom de famille dans le HTML de la **liste** d'un
mandat — alors qu'aucun composant ne l'affichait, et que je venais de retirer le prénom de la carte.

**Cause** : Next sérialise dans la page la charge utile RSC de tout ce qui franchit la frontière
serveur → client. `candidatsDuMandat` sélectionnait `COLONNES_CANDIDAT`, devenu porteur de `nom`
depuis D-14. La colonne n'était pas rendue ; elle était **envoyée**.

**Correctif** : un jeu de colonnes distinct pour la liste, `COLONNES_CANDIDAT_LISTE` — ni nom, ni
prénom, ni CV, ni photo. **Ne pas afficher ne protège rien ; ne pas demander, si.**

**Vérifié après coup**, sur les 7 mandats et les 35 candidats présentés du compte de test :
0 liste laisse filtrer un nom, 35 fiches sur 35 nomment le candidat.

---

## D-16 — Le harnais cherchait dans un texte d'où les attributs avaient disparu

**Date** : 09/09/2026 · **Statut** : appliquée

Le contrôle « le nom n'apparaît nulle part dans le HTML servi » passait par une fonction
`texteDe(html)` dont le `.replace(/<[^>]+>/g, ' ')` supprime **la balise avec ses attributs**.
Il était donc structurellement incapable de voir une fuite par un `href`, un `src` ou un `alt` —
c'est-à-dire exactement la fuite qui existait. Il était vert, et il ne prouvait rien.

Réécrit : la recherche porte sur le **HTML brut**, et le contrôle affirme désormais les deux
régimes de D-14 — le nom **doit** être sur la fiche, il **ne doit pas** être sur la liste.

---

## D-17 — Le SIREN est accepté à côté du SIRET

**Date** : 09/09/2026 · **Statut** : appliquée · **Migration** `20260912111000`

`api.maj_entreprise` et le schéma de saisie exigeaient `^[0-9]{14}$`. **34 des 851 entreprises**
portent une valeur qui échoue — 32 sont des SIREN à 9 chiffres. Les fonctions « maj_ »
enregistrant un formulaire entier, ces 34 clients ne pouvaient modifier ni leur description, ni
leur logo, ni leur effectif sans corriger d'abord un champ qu'ils n'avaient jamais touché.

Même défaut que celui déjà réparé pour `site_web`, `video_url` et `logo_url` : **une règle écrite
d'après ce qu'on croit que la donnée contient.** La mesure d'abord, la règle ensuite.

---

## D-18 — Une saisie illisible est refusée, jamais effacée

**Date** : 09/09/2026 · **Statut** : appliquée

`nombreOptionnel` transformait une saisie non numérique en `null`. Taper « douze » dans
« Effectif total » **effaçait** la valeur au lieu de la refuser : une perte de donnée sans
message, le pire mode d'échec d'un formulaire. La saisie illisible lève désormais une erreur.

---

## D-19 — Le focus clavier redevient visible dans les listes déroulantes

**Date** : 09/09/2026 · **Statut** : appliquée

`ELEMENT_LISTE` signalait l'élément survolé **et** l'élément focalisé par `--violet-050`, soit
**1,03:1** sur blanc, en posant `outline-none`. Naviguer aux flèches ne montrait rien — ce qui
contredit la règle de base du projet (« `:focus-visible` jamais supprimé ») et échoue à WCAG 2.4.11.

Un anneau est posé sur `:focus-visible` **seul** : la souris garde exactement l'apparence du
Figma, le clavier gagne un indicateur qui se voit. C'est le seul composant préexistant du design
system que j'aie touché, et l'ajout ne change ni son contrat ni son rendu à la souris.

---

## D-20 — Les adresses des comptes de test sortent du dépôt public

**Date** : 09/09/2026 · **Statut** : appliquée

`.gitignore` exclut `COMPTES_DE_TEST.md` en expliquant pourquoi : « adresses de personnes réelles
et mots de passe en clair, le dépôt est public ». Or les harnais livrés **codaient en dur les
mêmes adresses** — trois contacts de clients réels — et le mot de passe, dans `frontend/tests/`,
qui est suivi par git.

Les valeurs passent en variables d'environnement (`TEST_ENTREPRISE_EMAIL`, `TEST_TALENT_EMAIL`,
`TEST_RECRUTEUR_EMAIL`, `TEST_MDP`) dans `.env.local`, ignoré. Documentées sans valeur dans
`.env.example`. Aucun défaut en dur : sans elles, le harnais refuse de tourner plutôt que de
passer au vert sur un compte deviné. `npm run verifier:j2` fonctionne enfin sans argument.

---

## Phase 1 — état à la clôture

| contrôle | résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npx eslint .` | 0 erreur, 1 avertissement documenté (`Tableau.tsx`, API TanStack Virtual) |
| `npm run build` | succès, 13 routes |
| `npx vitest run` | 132 tests verts |
| `verifier:j1` · `j2` · `j3` · `j3-ecrans` | tous verts |
| contrôle d'identité indépendant | 7 listes, 35 candidats : **0 fuite**, 35/35 fiches nommées |

**Signalé, non traité — ce sont des arbitrages, pas des défauts :**
`--encre-500` mesure 3,92:1 sur blanc, sous AA : c'est une **9ᵉ paire** à ajouter aux 8 déjà
arbitrées « pour la charte », pas une régression de ce lot · le brouillon de brief n'est pas
conservé si l'on quitte la page · trois référentiels (étapes visibles, motifs de refus, univers)
sont recopiés en dur côté front faute de `api.etape_client` et `api.motif_ko_client` · 23 noms sur
1 000 portent un espace parasite en base (l'affichage les trime déjà).

---

# RETOURS DU COMMANDITAIRE SUR LA PHASE 1

## D-21 — Le texte qui n'aide pas est retiré, celui qui évite une erreur reste

**Date** : 09/09/2026 · **Statut** : appliquée

Retour, formulé deux fois : « il y a trop de textes superflus un peu partout qui sont inutiles ».

Balayage systématique plutôt que cas par cas : **50 textes de plus de 60 caractères** rendus à
l'écran dans le portail. Un principe pour trancher chacun :

> **Garde ce qui change une action ou évite une erreur. Supprime ce qui explique la philosophie du
> cabinet, justifie un choix de conception, ou paraphrase ce que l'écran montre déjà.**

**6 éléments supprimés** (dont les quatre cités : l'explication du compteur « candidatures », le
« ce que vous choisissez arrive tout de suite chez votre agent », le « ces informations alimentent
vos annonces », le « nous n'avons pas encore écrit notre recommandation » réduit à une ligne),
**41 raccourcis**. Il ne reste **aucun texte de plus de 85 caractères**.

Ce qui a été **gardé**, et pourquoi : la mention de confidentialité sur la fiche candidat (elle dit
au client ce qu'il reçoit) · l'avertissement d'irréversibilité sur un refus · le format attendu d'un
identifiant YouTube et d'une adresse de logo (ils évitent un refus d'enregistrement) · l'unité des
montants (K€ contre €, ratio 1000 mesuré en base).

Effet de bord assumé : la prop `aide` de l'en-tête d'étape du brief devient optionnelle. La plupart
des étapes se comprennent par leur titre et leurs champs.

---

## D-22 — Le compteur qui contredisait son total

**Date** : 09/09/2026 · **Statut** : appliquée · **Migration** `20260913120000`

Sa capture montrait **« 5 dont 8 en cours »** et **« 9 dont 11 en cours »**. Cause : `en_cours`
comptait **toutes** les candidatures non-KO — y compris celles d'amont, invisibles du client —
alors que `presentes` ne comptait que les visibles. Un sous-total plus grand que son total.

Les trois compteurs de `api.mandat_client` parlent désormais du **même ensemble** : les
candidatures visibles du client. Un compteur du cabinet n'a rien à faire dans une vue client — il
l'informait d'un travail qu'il ne voit pas, avec un nombre qu'il ne pouvait pas rapprocher.

---

## D-23 — Trois défauts de la fiche candidat, trouvés en la mesurant

**Date** : 09/09/2026 · **Statut** : appliquée · **Migrations** `20260913120000` et `121000`

Retour : « il faudrait que l'on puisse voir plus de détails sur cette fiche, c'est important pour
l'entreprise ». En l'enrichissant, trois défauts sont apparus — aucun n'était visible à la lecture
du code.

| mesuré | cause | correctif |
|---|---|---|
| **`expertises` revenait vide au client** — la clé de service lisait `['Data']`, le jeton client `null` | aucune policy client sur les **9 satellites** de `core.fiche_talent`. La vue étant `security_invoker`, la sous-requête rendait zéro ligne. Encore D-12 | une policy par satellite, sur `api.mes_talents_presentes()` |
| **`poste_actuel_employeur` affichait un identifiant Bubble** — `1694609297157x182158973721116670`, sur **873 des 1 298 employeurs renseignés, 67 %** | la colonne texte porte l'identifiant, et `poste_actuel_entreprise_id` existait à côté, vide | rattachement par `bubble_id` et **écriture du nom en base** — pas un masquage d'affichage : masquer laisserait la donnée fausse pour le prochain lecteur. Ceux qui ne correspondent à rien laissent un blanc |
| **`niveau_anglais` sortait en code brut** — `courant_quotidien` | `ref.libelle` porte le domaine et personne ne le joignait | « Natif ou Top niveau écrit et oral » |

La fiche porte maintenant **trois sections** et 18 champs factuels de plus, dont les **années
d'expérience calculées** — le chiffre que cherche un recruteur, que personne ne stockait.

**Deux colonnes retirées après mesure** : `seniorite` est renseignée sur **0** des 1 893
candidatures visibles, et `ecole` ne contient pas une école — **`'yes'`/`'no'` sur 787 lignes**,
c'est-à-dire la sémantique de `grande_ecole`, le marqueur de tri social que D-14 avait écarté.
Je les avais ajoutées **sans les mesurer d'abord** : exactement la faute que ce projet a déjà payée
trois fois. `create or replace view` ne sait pas supprimer une colonne (42P16) — il a fallu
détruire la vue et réaccorder ses droits.

---

## D-24 — Copier une fiche, parce qu'elle finit dans un autre ATS

**Date** : 09/09/2026 · **Statut** : appliquée

« Qu'il y ait des options pour copier ces infos, parce que généralement ils en ont besoin pour leur
ATS. » C'est le geste réel : un client ne lit pas une fiche, il la **recopie**.

`BoutonCopier` (design system) + `ficheEnTexte()` produisent un bloc texte prêt à coller : identité,
référence de suivi, parcours, attentes, notre lecture, lien du CV. **Du texte et pas du JSON** : la
destination est un champ « notes », pas un programme. **Les rubriques vides sont omises**, jamais
rendues avec un tiret — coller vingt lignes dont douze disent « — » coûte plus de temps que de
retaper.

Trois partis pris techniques : l'accusé de réception est obligatoire (une copie ne produit aucun
changement visible, donc on reclique) et annoncé en `aria-live` ; repli par `document.execCommand`
quand `navigator.clipboard` manque, parce qu'un bouton muet est pire qu'une API dépréciée ; minuterie
nettoyée au démontage.

---

## D-25 — Qui est connecté, sur les quatre portails d'un coup

**Date** : 09/09/2026 · **Statut** : appliquée · **Migration** `20260913130000`

« Je ne vois toujours pas le nom de l'utilisateur affiché quelque part, et l'option pour qu'il
puisse modifier ses propres infos. » Et oui : `core.contact_client` tient bien **524 personnes**
avec nom, prénom, adresse, fonction et photo.

**Pourquoi dans `api.moi` et pas dans une vue par portail** : `CoquilleConnectee` est partagée par
les quatre portails et **ne sait pas dans lequel elle se trouve** — c'est chaque page qui le sait.
Une fonction `api.mon_identite()` résout la personne sur les **trois tables** vers lesquelles
`app.acces` peut pointer (contact client, fiche talent, collaborateur), et `api.moi` gagne
`prenom`, `nom`, `photo_url`. Vérifié sur les trois types de compte : « Pierre Duverney-pret »,
« Aubin Curet », « David MOREL ».

Écran `/entreprise/compte` + `api.maj_mon_compte`, cinq colonnes en liste blanche.
**L'adresse est montrée et ne se modifie pas** : c'est l'identité d'authentification, et c'est par
elle que `api.rattacher_compte` a relié la personne à sa fiche. La changer n'est pas corriger une
faute de frappe, c'est déplacer un accès.

**Piège rencontré** : `hrefCompte()` posée dans `lib/acces.ts` a cassé le build. La coquille est un
composant **client** ; importer une *valeur* de `lib/acces.ts` y tire `lib/supabase/serveur.ts` et
donc `next/headers` dans le paquet du navigateur. L'import de `type { Portail }` était effacé à la
compilation, d'où l'illusion que le module était neutre. La fonction vit maintenant dans
`lib/navigation.ts`, qui n'importe qu'un type.

---

## D-26 — Deux chiffres au lieu de trois, et pourquoi ce n'était pas qu'un défaut d'affichage

**Date** : 09/09/2026 · **Statut** : appliquée

Sa capture montrait trois compteurs illisibles dans la barre latérale : « 5 candid… », « 5 prése… »,
« 5 en cours », chiffres chevauchés et libellés coupés.

**La cause visuelle** : `TuileCompteur` porte `min-w-[178px]` — une cote relevée du Figma, où elle
sert un tableau de bord pleine largeur. Trois d'entre elles dans une colonne de 300px reçoivent
90px chacune. Elle **n'est pas faite pour une barre latérale**, et la forcer là était l'erreur.

**Mais le vrai défaut était en amont** : depuis D-22, `candidatures` et `presentes` comptent le
**même ensemble**. Deux tuiles côte à côte affichaient donc toujours le même nombre — ce qui se lit
comme un bug, pas comme une information. Élargir la colonne aurait rendu lisible une redondance.

Deux lignes « chiffre + libellé » remplacent les trois tuiles : **profils présentés** et
**encore en cours**. Rien ne peut se tronquer, et chaque chiffre dit quelque chose de différent.

---

## D-27 — Les recruteurs, que le client ne voyait jamais

**Date** : 09/09/2026 · **Statut** : appliquée · **Migration** `20260913180000`

Retour : « vous indiquez sur une offre l'Account Manager mais jamais vous n'indiquez le ou les
recruteurs ».

**Tout était en place sauf la vue.** `core.mandat` porte `agent_en_charge_id` et `agent_2_id` vers
`core.collaborateur` ; la policy `api.mes_agents_client()` (migration 098000) les interrogeait
**déjà** — `array[m.account_manager_id, m.agent_en_charge_id, m.agent_2_id]` ; et le cadrage P0 en
fait une feature `must`, « Affectation d'équipe sur le mandat (AM + agents) ». Le droit était
ouvert, la porte n'existait pas.

**Et la mesure inverse l'intuition.** Sur les 533 mandats :

| | renseigné |
|---|---|
| recruteur 1 (`agent_en_charge_id`) | **475 — 89 %** |
| Account Manager | 402 — 75 % |
| recruteur 2 (`agent_2_id`) | 25 — 5 % |
| aucun des trois | 31 |

Le client voyait donc **le champ le moins rempli**, et pas celui de la personne qui cherche
réellement pour lui.

**Ce qui a été fait** : une `CarteEquipe` sur la fiche du poste, qui distingue les deux rôles — l'AM
est le point d'entrée (ouvrir un poste, ajuster un brief), les recruteurs sont ceux qui sourcent.
Les fondre dans une liste indifférenciée ferait perdre à qui s'adresser. Et sur le tableau de bord,
la colonne « Votre agent » devient **« Qui cherche »**, avec le recruteur en premier et l'AM en
repli : sur une liste de postes la question est « qui travaille sur celui-là », l'AM étant le même
pour toute l'entreprise et déjà présent dans le bandeau.

**Aucune adresse électronique pour les recruteurs.** Le client passe par son Account Manager, qui
est son interlocuteur unique. Un recruteur nommé et joignable en direct ouvrirait un canal
parallèle que personne n'a décidé d'ouvrir — même règle que pour les coordonnées d'un candidat
(D-14). Vérifié : aucun `mailto:` de recruteur dans la page.

**Piège de calendrier** : `supabase db push` a refusé ma migration horodatée `140000`, la squad
Phase 2 ayant appliqué une `170000` entre-temps (« Found local migration files to be inserted
before the last migration on remote »). Renumérotée en `180000` plutôt que forcée avec
`--include-all`, qui aurait appliqué en aveugle tout ce qui traînait.

---

## D-28 — La barre latérale passe aux icônes Lucide

**Date** : 09/09/2026 · **Statut** : appliquée

Demande : « utilisez des icônes Lucide React sur la sidebar ». C'est la deuxième fois que la
préférence est exprimée — la première portait sur le badge du sélecteur de vue.

**Le design system portait déjà la réponse, et je ne l'avais pas vue.** `ElementMenu` accepte
depuis toujours une union fermée `{emoji} | {icone}`, et son propre commentaire dit pourquoi :
« à cette taille les émojis rendent inégalement d'une plateforme à l'autre, et ils ne suivent pas
la couleur du texte ». Le second point est décisif ici : l'entrée active de la barre passe en
violet, et un émoji restait à sa couleur propre.

Seul le type des sections de `Menu` exigeait `emoji`. Élargi au même `VisuelElementMenu` — **ajout
purement additif, aucun contrat cassé** — et comme `Menu` faisait déjà `{...e}` vers
`ElementMenu`, il n'y a **rien eu à changer au rendu**. Les sections à émoji continuent de compiler.

**On passe par le composant `Icone`, pas par un import direct de `lucide-react`.** Le DS le dit :
c'est le point unique où se règlent la cote (24px par défaut, réduite ici à 16px pour tenir dans la
gouttière de 20px de `ElementMenu`) et la question décoratif / signifiant. Une icône importée à la
main dans un écran est une icône dont personne ne vérifie le rôle. Ici elle est décorative —
`ElementMenu` la pose sous `aria-hidden`, le sens reste dans le libellé.

`lib/navigation.ts` devient `lib/navigation.tsx` : il produit désormais des éléments.

Les cinq entrées : `bar-chart-2`, `plus`, `user`, `briefcase`, `file-text`.

**Ce que je n'ai PAS touché** : les émojis de `InfoLigne` et `CarteOffre` (💸 📍 🖥️) et ceux des
onze étapes de `StatutProcess`. Ils sont dessinés dans le Figma, ils portent le vocabulaire métier,
et le retour portait sur la barre latérale. Les changer serait redessiner le job board.

**Vérifié** : plus aucun des cinq émojis dans la barre, 8 `<svg>` Lucide rendus, `currentColor`
présent — les icônes suivent bien la couleur de l'entrée active.
