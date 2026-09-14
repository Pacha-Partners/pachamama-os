# Reprise — état du projet Pachamama

> Point de départ après compactage. État au **25/08/2026, 07:18 UTC**.
> Chaque chiffre de ce document a été mesuré en production, pas estimé.

## Le projet en trois parties, et l'ordre

```
1. LA BASE TALENT UNIFIÉE  →  2. L'APPLICATION  →  3. LE CHASSEUR DE TALENTS
        (socle)                (4 vues + job board)
```

L'ordre est une contrainte de dépendance : on ne branche pas un moteur de
rapprochement sur deux bases qui se contredisent.

---

## Où on en est, au 28/08/2026

**LES DEUX PREMIERS SCHÉMAS DU MODÈLE CIBLE SONT EN DEV.** Vérifiés par dump,
pas seulement par le message de la CLI.

| schéma | contenu | migration |
|---|---|---|
| `ref` | 30 types énumérés, 15 tables, 47 index, 32 CHECK | `20260828093000_schema_ref.sql` |
| `config` | 8 tables, 15 index, 8 CHECK | `20260828101500_schema_config.sql` |
| `core` (talent) | 14 tables, 29 index, 24 CHECK, 24 FK | `20260828113000_core_talent.sql` |
| `core` (entreprise) | 6 tables | `20260828143000_core_entreprise.sql` |
| `core` (personnes internes) | 3 tables | `20260828160000_core_personnes_internes.sql` |
| `core` (mandat / candidature / placement) | 10 tables | `20260828174500_core_mandat.sql` |
| `core` (note et tâche) | 2 tables | `20260828190000_core_note_tache.sql` |
| unités du placement | commentaires de colonnes, mesurés | `20260828200000_unites_placement.sql` |
| `ref.tag_job` corrompu | constat consigné dans la base | `20260828203000_ref_tag_job_corrompu.sql` |
| `app` | 6 tables, 4 énumérés, et les 5 dernières FK différées | `20260828213000_schema_app.sql` |
| amorçage des référentiels | 1 535 insertions, 558 correspondances | `20260828230000_amorcage_referentiels.sql` |
| valeurs découvertes en données | 19 métiers et expertises | `20260828234500_valeurs_decouvertes.sql` |
| arbitrages finaux | vivier abandonné, unités nommées, superadmin | `20260829090000_decisions_finales.sql` |
| audit de cohérence | 57 index de clé étrangère, 1 énuméré mort | `20260908103000_audit_coherence.sql` |
| amorçage de `config` | 37 insertions — oubli du premier amorçage | `20260908140000_amorcage_config.sql` |
| RLS fermée par défaut | 64 tables protégées, 22 policies de lecture | `20260908150000_rls_ferme_par_defaut.sql` |
| correction des statuts de mandat | appariement décalé — 533 mandats sauvés | `20260908170000_corriger_statut_mandat.sql` |
| correspondances manquantes | 9 valeurs hors référentiel + vue de garde | `20260908180000_correspondances_manquantes.sql` |
| **la reprise** | 9 migrations, 141 617 lignes métier | `202609082010*_reprise_*.sql` |
| contraintes après chargement | 5 CHECK + le déclencheur du compte + 3 vues | `20260908220000_contraintes_apres_reprise.sql` |
| schéma `api` | authentification + rattachement des comptes | `20260908230000_schema_api.sql` |
| policies et vues | 3 portails, 8 vues, RLS complète | `20260908234500_policies_et_vues.sql` |
| correctifs de l'audit valeur | 5 défauts, ~3 800 valeurs récupérées | `2026090909*_audit_valeurs_correctifs*.sql` |

## LE DOCUMENT DE RÉFÉRENCE

**`docs/LE_MODELE.md`** — écrit le 09/09/2026. Ce qu'est le modèle, pourquoi il
est fait ainsi, et comment s'en servir : les quatre schémas et leur règle, les
trois partis structurants, la carte des entités par domaine, les conventions à
connaître avant d'écrire une requête, la couche `api`, ce que le modèle ne porte
pas délibérément, et ce qui a été perdu — par nous et par le miroir avant nous.

C'est le point d'entrée. Les autres documents en sont le détail.

---

## J1 — LA PAGE JOBS EST CONSTRUITE — 09/09/2026

Portée du Figma « Job board ». La page `/offres` sert les **12 offres réelles**
depuis `api.offre_publique`, avec la clé publique et la RLS — jamais la clé de
service. Vérifié sur le HTML réellement servi (200, 97 Ko) :

| ce que la page rend | attendu | rendu |
|---|--:|--:|
| cartes d'offre | 12 | 12 |
| « Tous les jobs (N) » | 9 | **9** |
| badges « Exclu Pachamama » | 7 | 7 |
| « Entreprise anonyme » | 12 | 12 |
| CDI / Freelance | 11 / 1 | 11 / 1 |
| Hybride / Full Remote France | 9 / 3 | 9 / 3 |

Les trois règles annotées sur la maquette sont implémentées : les « petits
nouveaux » sont les **3 plus récentes qui respectent les filtres**, « Tous les
jobs » compte le reste **sans** ces trois, et l'ordre va du plus récent au plus
ancien.

### Ce que la base a dû apprendre

`api.offre_publique` porte trois colonnes de plus — le **code** d'univers (une
clé stable pour filtrer et teinter, le libellé ne suffit pas), le **type de
contributeur** qui est le filtre « Management », et l'**exclusivité** qui porte
le badge. Et ses propres **libellés d'affichage** : `ref` n'étant pas un schéma
exposé, le navigateur ne peut pas aller les chercher, et les recopier dans le
front créerait une seconde vérité.

*Piège rencontré* : `CREATE OR REPLACE VIEW` refuse de renommer une colonne
(« cannot change name of view column »). Un `DROP` explicite s'impose, avec les
droits réaccordés.

### Trois ajouts au design system, tous prescrits par la maquette

- **`Bouton href`** — une navigation doit être un lien, pas un bouton qui
  déplace la page en JavaScript ; sans quoi le clic du milieu, « ouvrir dans un
  onglet » et l'indexation sont perdus. Un lien désactivé n'existant pas en
  HTML, `disabled` fait retomber sur un vrai `<button>` inerte.
- **`Titre disposition="ligne"`** — le duo « Les jobs / Pachamama » est côte à
  côte ici. La règle de la charte tient : même taille, le contraste serif/sans
  porte seul la hiérarchie.
- **Le déclencheur teinté garde son libellé** — `teinteTags` promettait déjà que
  les choix « sont affichés en tags AILLEURS sur l'écran ». Il les répétait
  pourtant dans le champ. Corrigé : « Univers » reste affiché, le fond passe en
  violet 050, les tags retirables vivent dessous.

### LE MOBILE, d'après `docs/Figma-css/Job_board_mobile.md` — 09/09/2026

Gouttière ramenée à **16px** sous `md` (32 au-delà), la barre figée suivant la
même cote.

**La rangée de filtres défile, elle ne se replie pas.** Le Figma la donne à
363px de large dans un cadre de 320 : le débordement est voulu, et l'annotation
le confirme. Mesuré à 375 — contenu 425px pour 375 visibles, gouttière 8px,
largeurs 95 / 150 / 133 puisque chaque filtre prend celle de son libellé.

**Un sélecteur n'ouvre pas la même chose selon la taille de l'écran.** Sous `md`
il ouvre une feuille modale, au-dessus une liste déroulante ancrée. Ce n'est pas
de l'habillage : les choix y sont un BROUILLON, appliqué par « Enregistrer » et
jeté par « Annuler », là où le desktop applique à chaque case. Deux composants
nouveaux : `Feuille` (la surface, sur `@base-ui/react/dialog`) et
`FeuilleDeSelection` (la liste et son brouillon), tous deux bâtis sur
`ListeItem`, `CaseVisuelle`, `TagUnivers` et `Bouton` — le Figma les nomme.

Neuf contrôles passés : ouverture, fermeture par Annuler / Enregistrer / la
croix, brouillon vide à l'ouverture, brouillon reflétant l'état au retour,
filtre réellement appliqué. Et le desktop reste identique sur les 52 points
d'empreinte, `aria-haspopup` valant toujours `listbox` au-delà de `md`.

**Trois pièges rencontrés, qui valent d'être écrits :**

`Select.Icon` est une pièce du sélecteur, pas une icône : la rendre hors de
`Select.Root` lève « SelectRootContext is missing ». Le chevron partage
désormais ses classes entre les deux branches.

`ListeItem` émet déjà son propre `<li>` ; l'envelopper en imbriquait deux et
doublait chaque libellé pour les aides techniques — six éléments annoncés pour
trois options.

**La fermeture d'une feuille ne doit pas dépendre d'une animation.** Base UI
laisse la surface montée et attend un `transitionend` pour la démonter : sans
règle qui la masque, une feuille fermée reste affichée. Mesuré, `display: flex`
et `opacity: 1` après « Enregistrer ». C'est `data-[closed]:hidden` qui ferme,
l'animation ne servant plus qu'à l'entrée — laquelle ne conditionne rien.

**Reste à trancher : le Figma mobile ne contient AUCUN bouton.** Le « Login »
n'y figure pas. Je l'ai conservé plutôt que de retirer en silence le seul accès
à l'espace talent depuis un téléphone.

### Ce que la donnée n'a pas, et qu'il faut savoir

**La localisation existait, mais le miroir ne la recevait pas.** Elle m'a d'abord
paru vide sur les 12 offres. Elle ne l'était pas : `Localisations` est une liste
saisie sur le mandat à sa création, renseignée sur **442 des 524** mandats de
Bubble — et le flux n8n ne rapatriait pas ce champ du tout. Ce n'est pas la perte
de records déjà connue, c'est un champ entier absent. `Remplacement` (79 mandats)
manque de la même façon.

Rattrapé le 09/09 par un backfill, puis compté en base et non sur un export :

| | attendu | présent |
|---|---|---|
| `public.mandat.localisations` (miroir) | 442 | 436 |
| `core.mandat.localisations_brut_json` | 436 | 436 |
| `core.mandat.localisation` (villes) | 436 | 436 |
| offres publiées avec un lieu | 12 | 12 |

Les 6 absents du miroir sont des mandats que le miroir dev n'a pas du tout — la
perte de records connue. Tout ce que le miroir a, le modèle l'a.

Le modèle en garde **deux formes** : `localisations_brut_json`, la liste Bubble
intacte (adresse complète et coordonnées, pour un usage carte plus tard), et
`localisation`, les villes seules concaténées — c'est elle que sert le job board.
L'extraction ne retient que la ville : 5 adresses portaient une rue numérotée et
41 un code postal, qui n'ont rien à faire sur une offre publique.

**La synchronisation n8n doit encore apprendre ce champ**, sans quoi les mandats
créés après le 09/09 arriveront de nouveau sans lieu. Reporté à votre demande.

Quand le lieu manque, la carte affiche **`N/A`** plutôt que de retirer la ligne :
une carte à laquelle il manque une ligne se lit comme une carte d'un autre
gabarit.

**Le référentiel a 8 univers, le design system en colore 4.** Mesuré sur les 533
mandats : seuls Product (269), Tech (132), Sales (40), People & Finance (13) et
Marketing (5) sont employés — design, data et finance n'ont aucun mandat. Quatre
des cinq se rangent sous une verticale ; « Marketing » prend la teinte neutre et
garde son libellé, la couleur étant décorative.

**Les options des filtres viennent des offres publiées, pas du référentiel.** Un
filtre qui ne rend rien tend un piège : le visiteur coche, l'écran se vide, il
en conclut que le site est cassé.

### Deux réserves assumées

- Le titre des cartes **n'est pas cliquable** : `/offres/[id]` sert encore des
  fixtures indexées par slug, un uuid y donnerait un 404. Il le redeviendra
  quand la fiche sera branchée sur la vue.
- Les deux **scribbles de section** sont désormais désignés et non plus
  déduits : `forme-4` pour « Les petits nouveaux », `forme-s` pour « Tous les
  jobs ». Ils avaient été choisis provisoirement pour leur sens (étincelles,
  flèche), faute de correspondance nommée entre les scribbles numérotés du
  Figma et le design system. Réserve levée le 09/09.

---

## CE QU'IL RESTE À FAIRE — non prioritaire, arbitré le 09/09/2026

Le socle est en place et rempli. Ce qui suit ne bloque pas la suite du projet
et attend son moment.

### Côté infrastructure

1. **Exposer `api`** — un réglage dans le tableau de bord Supabase. Additif :
   on n'enlève rien, donc rien ne casse. Sans lui, les 8 vues existent mais ne
   répondent pas au réseau.
2. **Le connecteur pivot → app** — il alimentera `core.talent`, la projection
   en lecture seule, aujourd'hui vide. C'est lui aussi qui renseignera les
   `talent_id` des casquettes (contact, collaborateur, apporteur), qu'aucune
   reprise ne peut établir.
3. **Migrer les connecteurs backend** vers `api` ou vers une connexion
   Postgres directe. Ils lisent aujourd'hui `public` et `pivot` en REST.
4. **Réduire la liste des schémas exposés** au seul `api`. Moins urgent qu'on
   ne l'a cru : les 107 tables de `public` et les 11 de `pivot` ont déjà la RLS
   activée sans policy, donc elles ne rendent rien à un utilisateur connecté.
   C'est de l'hygiène, pas une faille.
5. **Rejouer la reprise en production**, une fois tout le reste éprouvé.

### Côté métier — trois avis qui ne bloquent rien

6. **L'ordre des 14 étapes du pipeline** — le seul attribut inféré du modèle.
7. **Le sens de « Job exclu »** — 18 mandats, sémantique inconnue, donnée
   conservée en attendant.
8. **L'unité de `montant_cooptation_talent`** — 3 valeurs, 1 · 250 · 350.

### À examiner

9. **Les 388 lignes en quarantaine** : 32 salaires qui sont des TJM, 15
   apporteurs à l'identité temporairement recopiée, 341 utilisateurs
   d'entreprise dont l'accès se recréera à la connexion.
10. **Les 3 vues de contrôle** qui remontent du réel : 4 secteurs à la fois
    visés et interdits, 109 candidatures en double, 25 répartitions dont le
    total ne retombe pas sur la commission.

---

### AUDIT DE NON-PERTE, NIVEAU VALEUR — 09/09/2026

Le rapprochement par LIGNES ne prouve rien : une ligne peut entrer avec toutes
ses colonnes vides. L'audit compare donc, pour **188 colonnes** du miroir, le
nombre de valeurs renseignées de chaque côté. Mapping explicite dans
`backend/database/audit/correspondance_colonnes.sql` — 173 reprises, 15 fusions,
39 abandons documentés.

**Masse totale à rendre : 1 136 243 cellules non vides.**

| verdict | colonnes | valeurs source | valeurs cible |
|---|--:|--:|--:|
| conservé (cible ≥ source) | 172 | 238 341 | 298 072 |
| en retrait | 16 | — | — |

**498 valeurs en retrait, soit 0,044 %** — et chacune a une cause nommée :

| cause | valeurs | nature |
|---|--:|---|
| `created_by` désignant un compte supprimé de Bubble | 426 | irréparable, la personne n'existe plus |
| artefact de comptage du tableau `note_user_ids` | 26 | 227 tableaux → 201 placements suivis |
| notifications orphelines (`task_id` nul) | 16 | perte déclarée du repli de task_notif |
| références portées deux fois par des notes fusionnées | 17 | artefact du dédoublonnage, pas une perte |
| `task.mandatclose_id` pointant un closing inexistant | 5 | défaut de la source |
| satellites orphelins (candidat inexistant) | 8 | 1 ligne par table 1:1 |

#### CINQ DÉFAUTS TROUVÉS ET CORRIGÉS

**1. L'auteur d'une candidature n'est pas toujours un interne.** 3 714 des 7 228
`created_by` désignent un candidat ayant créé sa propre candidature. La colonne
cible ne pouvait porter qu'un collaborateur. Même solution que pour les notes :
une seconde clé étrangère nullable. **3 712 valeurs récupérées.**

**2. Un cinquième niveau d'anglais existait dans les données.** « Bon niveau
global mais pas au quotidien », 59 candidats, absent du référentiel. Le balayage
du 28/08 n'avait couvert que les métiers et les expertises ; celui-ci a porté sur
les **48 colonnes** adossées à un énuméré et n'a trouvé que celle-là.

**3, 4 et 5. Le repli sur les valeurs découvertes manquait en trois endroits.**
Les 17 métiers saisis au clavier sont enregistrés sous le référentiel
`donnees.metier`, mais trois requêtes interrogeaient le seul `ref_metier`.
**38 valeurs récupérées.** Et la trace d'absorption des contacts ne couvrait que
les lignes rattachées à un mandat : reconstruite, elle a rendu leur contact à
**9 mandats**.

*Piège rencontré* : `ALTER TYPE … ADD VALUE` ne peut pas être suivi, dans la même
transaction, d'un usage de la valeur créée. La mise au point locale, faite en
deux passes, ne l'avait pas révélé — d'où la scission en deux migrations.

### LE MODÈLE EST UTILISABLE — 08/09/2026

**Une correction importante de ma part.** J'ai affirmé deux fois que la couche
`api` serait contournable tant que `public` et `pivot` resteraient exposés.
**C'est faux, et vérifié** : les 107 tables de `public` et les 11 de `pivot` ont
DÉJÀ la RLS activée sans aucune policy. Un utilisateur connecté y lit zéro
ligne, et `pivot` lui refuse même l'usage du schéma. Le miroir est déjà fermé.

Conséquence : **il ne reste qu'un seul réglage, additif et sans risque** —
ajouter `api` à la liste des schémas exposés. Rien à retirer, donc rien à
casser. La synchro n8n et les connecteurs continuent de fonctionner.

**Chaîne vérifiée de bout en bout** : création d'une connexion → le déclencheur
la rapproche par l'e-mail → le compte pré-provisionné est rattaché avec son
accès talent. Testé sur une vraie utilisatrice, puis la connexion d'essai a été
supprimée.

**Ce que la couche `api` expose** : `moi`, `offre` (le job board), `ma_fiche`,
`ma_candidature`, `mandat_client`, `candidature_client`, `talent_recherche`,
`kanban`. Toutes en `security_invoker`, donc soumises à la RLS de l'appelant.

La séparation est nette : la POLICY choisit les lignes, la VUE choisit les
colonnes. Une candidate voit sa candidature mais pas l'appréciation qu'un
recruteur y a écrite — aucune policy talent n'existe sur `core.note`.

**Le modèle est structurellement complet.**

| schéma | tables | types | index | CHECK | FK |
|---|--:|--:|--:|--:|--:|
| `ref` | 15 | 33 | 32 | 32 | 6 |
| `config` | 8 | — | 15 | 9 | 2 |
| `core` | 35 | — | 113 | 61 | 118 |
| `app` | 6 | 4 | 20 | 11 | 15 |

Plus aucune colonne n'attend de clé étrangère.

Écrits en premier parce qu'ils n'ont aucun arbitrage ouvert et que tout le
reste du modèle y pointe. Chaque migration a été validée sur un PostgreSQL 17
jetable AVANT d'être poussée, contraintes comprises : le singleton du branding,
les préfixes de `ref.evenement_note` et `ref.type_tache`, le garde-fou qui
refuse un secret en clair dans `config.integration`, la forme des identifiants
SendGrid (6/6 conformes, mesuré).

**L'ordre des énumérés est celui du `sort_order` du miroir**, PostgreSQL triant
un type énuméré par ordre de déclaration. C'est ce qui préserve l'ordre
d'affichage vu par les recruteurs sans ajouter une seule colonne.

**Trois énumérés accueillent des valeurs absentes de leur référentiel**, sans
quoi la reprise échouerait : `type_contrat` reçoit `entrepreneur` (37 lignes
réelles), `type_produit_entreprise` 5 valeurs mesurées dans les données (16
lignes), `rythme_remote` 3 vocabulaires anciens (526 lignes). `statut_mandat`
reçoit en plus `en_pause` et `reprise`, sur consigne métier explicite, placés à
leur rang logique et non en fin d'énuméré.

### Le domaine du talent, en place

`core.talent` (la projection, 53 colonnes) et `core.fiche_talent` (81 colonnes)
plus ses 12 satellites. Les deux verrous de la lecture seule sont vérifiés :
un rôle applicatif se voit refuser l'écriture par les droits, et un rôle qui
AURAIT les droits est arrêté par le déclencheur. La suppression d'une fiche
emporte ses satellites et laisse la projection intacte — testé.

`talent_id` reste NULLABLE et NON UNIQUE sur la fiche : c'est la correction de
la Décision 3, et deux fiches partageant un talent sont acceptées, comme le
veulent les 374 fusions du pivot.

**Six colonnes attendent leur clé étrangère** parce que la table cible n'existe
pas encore : `poste_actuel_entreprise_id`, `agent_referent_id`,
`apporteur_affaires_id`, `cree_par_compte_id`, `fiche_talent_tag.tag_id` et
`pose_par_compte_id`. Une migration « liens » les posera une fois `core` et
`app` complets. Les colonnes existent, la contrainte manque : à ne pas oublier.

**Écart assumé avec le détail** : les montants sont en `numeric(12,2)` et non en
`numeric` nu, pour s'aligner sur candidature et placement.

### Entreprise et contacts, en place

Les 6 tables du domaine, et trois des six clés étrangères que le domaine
talent avait laissées en attente sont désormais posées.

**Un écart délibéré avec le détail, fondé sur la mesure.** Le détail écrivait
les vocabulaires de ce domaine en `_code text` alors que `core.fiche_talent`
type les MÊMES notions par leur énuméré — deux conventions pour une réalité.
Mesuré colonne par colonne sur les 851 lignes de `public.entreprise` : statut
5 valeurs, formule 4, agence 5, recommandation 5, niveau_anglais 4,
product_type 11, type_entreprise 0 — **zéro orpheline**. Les colonnes sont
donc typées par leur énuméré ou par une vraie clé étrangère. Seuls `garantie`
et `paiement`, qui n'ont aucun référentiel au miroir, restent en text + CHECK.

**PIÈGE ÉVITÉ, à retenir pour toutes les migrations suivantes.** Le détail
prescrivait deux contraintes `NOT VALID` « pour ne pas bloquer la reprise ».
C'est faux, et je l'ai vérifié : `NOT VALID` dispense du contrôle les lignes
DÉJÀ présentes, mais toute insertion ultérieure est vérifiée. Posées avant le
chargement, ces contraintes auraient rejeté exactement les lignes qu'elles
étaient censées épargner — les 42 contacts sans nom, 29 sans prénom, 92 sans
e-mail. L'ordre correct est : créer la table sans la contrainte, charger,
PUIS ajouter la contrainte `NOT VALID`. Les deux concernées
(`contact_identifiable`, `tag_une_seule_attache`) sont documentées en
commentaire à l'endroit exact où elles devront être posées.

**Défaut du détail corrigé** : `core.mandat_contact_client` y était spécifiée
DEUX fois, par deux domaines, avec des attributs différents. La version du
domaine mandat est marquée supersédée — elle référençait un type
`role_contact_mandat` qui n'existe dans aucun des 28 énumérés.

### Personnes internes, en place

`core.collaborateur`, `core.collaborateur_univers`, `core.apporteur_affaires`,
et les **sept clés étrangères** que le collaborateur débloque.

**Le compte exact des internes : 38 personnes, pas 41.** Le 41 comptait les
LIGNES de `user_role` ; certaines personnes cumulent deux rôles. Et la table
porte en plus les ANCIENS : 4 personnes sans rôle interne restent référentes
sur 1 959 fiches. D'où le couple `actif` / `est_supprime`.

**`collaborateur_univers` reste une table de liaison**, contre la lettre de la
Décision 4 qui annonçait un repli en colonne. Mesure : 8 lignes pour 2
personnes, jusqu'à 7 univers pour une seule — un repli perdrait 6 lignes sur 8.

**`core.apporteur_affaires` : version TOLÉRANTE retenue, et c'est réversible.**
L'arbitrage strict/tolérant reste ouvert. La version stricte est celle que le
détail recommande, mais elle a un préalable absent du plan — créer au pivot les
5 apporteurs qui ne sont pas des talents. La tolérante ne ferme aucune porte :
resserrer le CHECK et supprimer deux colonnes est une petite migration, tandis
que choisir le strict maintenant ferait échouer la reprise tant que le préalable
n'est pas exécuté.

**Nom d'énuméré corrigé** : le détail écrit `ref.fonction_user`, l'énuméré créé
s'appelle `ref.fonction_utilisateur`.

### `core` est complet, à une table près

35 tables. Il ne manque que **`core.vivier_mandat`**, dont la définition
métier est attendue : 2 603 couples dont 2 596 sont déjà des candidatures.
La créer sans savoir ce qu'elle dit serait figer une ambiguïté.

**Cinq contraintes que le détail laissait « à mesurer » l'ont été.** Trois
sont refusées, et c'est le résultat qui compte :

| contrainte | mesure | verdict |
|---|---|---|
| mandat : salaire_min ≤ salaire_max | 373 ok, **2 violent** | refusée |
| mandat : tjm_min ≤ tjm_max | 99 ok, 0 violent | posée |
| placement : fin_mission ≥ debut_mission | 78 ok, **1 violent** | refusée |
| placement : fin_garantie ≥ date_closing | 159 ok, **1 violent** | refusée |
| répartition : les 6 `_pct` dans [0,100] | 267 ok, 0 hors | posées |

Les trois refusées sont écrites en commentaire à leur emplacement exact,
avec les lignes fautives à corriger. Elles se posent APRÈS la reprise, en
`NOT VALID`.

**Trois énumérés ont été ajoutés à `ref`** (qui en compte 33) : `equity_mandat`
et `type_deal`, issus de CHECK inline du miroir et absents des 47 tables
`ref_*` ; et `statut_paiement`, sans source, exigé par la facturation.

**`mandat.recruteur_id` est devenu `contact_recruteur_id`** et pointe
`core.contact_client` : ses 36 valeurs se résolvent toutes dans `equipe`,
aucune dans `public.user`. Ce n'est pas un recruteur de Pachamama mais
l'interlocuteur côté client.

**Un blocage de reprise à lever** : `core.mandat_tag_job` a 830 lignes à
charger, mais la 16e valeur « Job exclu » (18 mandats) n'a jamais existé
dans le référentiel Bubble. `ref.tag_job` doit la porter avant le chargement.

### LA REPRISE EST FAITE, SUR DEV — 08/09/2026

**141 617 lignes métier chargées**, en 22 secondes, par 9 migrations rejouables.
Vérifié sur le projet en lisant `reprise.controle`, pas sur le message de la CLI :
**22 contrôles exacts, 4 écarts tous expliqués**.

| cible | attendu | inséré |
|---|--:|--:|
| `core.collaborateur` | 42 | 42 |
| `core.entreprise` | 850 | 850 |
| `core.contact_client` | 524 | 524 |
| `core.produit` | 103 | 103 |
| `core.fiche_talent` | 7 023 | 7 023 |
| ↳ ses satellites | — | 66 527 |
| `core.mandat` | 533 | 533 |
| `core.candidature` | 7 236 | 7 236 |
| `core.placement` | 227 | 227 |
| `core.note` | 45 685 | 45 685 |
| `core.tache` | 1 136 | 1 136 |
| `app.compte` | 4 159 | 4 159 |
| `app.acces` | — | 4 196 |
| comptes sans accès | 0 | **0** |

Les 4 écarts : 18 correspondances de contacts absorbés sans e-mail, 18 tags
« Job exclu » devenus un booléen (voulu), 6 répartitions orphelines à la source,
et l'avertissement sur la prose anonymisée.

**Contraintes posées APRÈS le chargement**, comme prévu : les 5 CHECK en
`NOT VALID` et le déclencheur `compte_a_un_acces` — éprouvé, il rejette bien au
COMMIT. Trois vues de contrôle remplacent les contraintes impossibles, et elles
remontent déjà du réel : **4 secteurs à la fois visés et interdits, 109
candidatures en double, 25 répartitions dont le total ne retombe pas sur la
commission**.

### CE QUE LA REPRISE A TROUVÉ — 08/09/2026

**Environnement de mise au point.** Le miroir anonymisé (36 Mo, 107 tables) est
rapatrié dans un PostgreSQL local À CÔTÉ du modèle : la reprise s'écrit en
`INSERT … SELECT` dans une seule base, avec un vrai psql et une itération
libre. Scripts dans `backend/database/reprise/`.

**Décision fondatrice : l'identifiant est DÉTERMINISTE.** `reprise.uid(bubble_id)`
calcule un uuid v5 — le même identifiant donne toujours le même uuid. La reprise
est donc REJOUABLE et PARTIELLE : on peut recharger une table seule, ses clés
étrangères se recalculent et retombent juste. Aucune table de correspondance à
maintenir.

#### Rapprochement au 08/09

| cible | attendu | inséré | verdict |
|---|--:|--:|---|
| `core.collaborateur` | 42 | 42 | exact |
| `core.entreprise` | 850 | 850 | exact |
| `core.contact_client` | 524 | 524 | exact — 764 lignes `equipe` repliées |
| `core.produit` | 103 | 103 | exact |
| `core.fiche_talent` | 7 023 | 7 023 | exact |
| ↳ ses 10 satellites | — | 66 016 | — |
| `core.mandat` | 533 | 533 | exact |
| `core.mandat_contact_client` | — | 706 | union des 2 sources |
| `core.candidature` | 7 236 | 7 236 | exact |
| `core.placement` | 227 | 227 | exact |
| `core.repartition_commission` | 266 | 260 | 6 écartés |
| `app.mandat_publication` | 36 | 36 | exact |

**Chaque écart est nommé** : 327 `created_by` d'entreprise désignent des comptes
supprimés de Bubble (irréparable) ; 18 liaisons manquantes sont exactement les
tags « Job exclu » devenus un booléen (voulu) ; 6 répartitions sont orphelines
à la source (5 sans `mandatclose_id`, 1 pointant un closing inexistant).

#### DEUX DÉFAUTS GRAVES TROUVÉS PAR LA REPRISE

**1. L'appariement des statuts de mandat était FAUX.** L'amorçage appariait les
valeurs du miroir aux étiquettes d'énuméré PAR POSITION. Correct quand les
valeurs ajoutées le sont en fin — mais `statut_mandat` reçoit `en_pause` et
`reprise` AU MILIEU. Résultat : **« Terminé » devenait `en_pause` et « Closé par
Pachamama » devenait `reprise`**, soit 477 mandats mal étiquetés sur 533.

Ce qui l'a arrêté : la contrainte `CHECK (statut <> 'en_pause' OR mis_en_pause_le
IS NOT NULL)`, posée seulement parce qu'`en_pause` était une valeur neuve sans
aucune ligne. Sans elle, la reprise passait en silence.

**2. Les valeurs ajoutées aux énumérés n'avaient pas de correspondance.** Créées
dans le type et dans `ref.libelle`, mais sans ligne de traduction — « Télétravail »
se traduisait en NULL et 26 rattachements se perdaient sans erreur. Le contrôle
de non-perte du 28/08 ne pouvait pas le voir : il vérifiait le sens
données→traduction, pas l'inverse.

Deux vues de garde sont posées : `ref.v_correspondance_suspecte` (deux libellés
visant le même code) et `ref.v_enum_sans_correspondance` (une valeur d'énuméré
sans traduction).

#### AUTRE DÉCOUVERTE : les salaires en euros continuent d'arriver

Le miroir porte encore **~200 salaires en euros**, 3 valeurs négatives et une
double conversion. Et ce n'est PAS un reliquat de l'harmonisation du 01/07 :
**64 des 65 valeurs en euros de `job_reve` ont été modifiées APRÈS cette date**.
La source continue d'en produire et continuera jusqu'à la coupure de Bubble.
`reprise.ke()` normalise au chargement ; le problème de fond reste côté Bubble.

**32 fiches sont en quarantaine** : un salaire annuel entre 250 et 1 000 K€, dans
la fourchette exacte des TJM — un taux journalier saisi dans le champ salaire.
Chargées telles quelles et signalées : aucune règle ne peut deviner l'intention.

#### Ce qui reste de la reprise

`core.note`, `core.tache`, `app.compte` + `app.acces`, `core.enquete_nps`,
`app.transition_etape` (naît vide). Puis les contraintes différées, les vues
`api` et les policies.

### SÉCURITÉ ET AMORÇAGE DE config — 08/09/2026

**La base est désormais FERMÉE PAR DÉFAUT.** Les 64 tables avaient la RLS
désactivée et zéro policy : un utilisateur authentifié y lisait tout, notes et
commissions comprises. Ce n'était pas encore une faille — aucun de ces schémas
n'est déployé en production — mais c'était un piège de calendrier : une base
ouverte par défaut le reste, et poser la RLS après avoir construit l'app la
casse en cent endroits.

RLS activée partout. Les policies métier ne sont PAS posées : elles liront
`app.acces` à travers les fonctions d'authentification du schéma `api`, qui
n'existe pas encore. `core` et `app` sont donc entièrement fermés, et c'est
délibéré — une requête qui renvoie zéro dira tout de suite qu'il manque une
autorisation.

Seule exception raisonnée : les vocabulaires restent lisibles (aucun secret de
ligne, et le job board en a besoin), sauf `ref.correspondance`. Le paramétrage
est lisible par un authentifié sauf `parametre` et `integration`.

| rôle | vocabulaires | branding | paramètres sensibles | core / app |
|---|--:|--:|--:|--:|
| `anon` | 255 | 1 | refusé | 0 |
| `authenticated` | 255 | 1 | 0 | **0** |
| `service_role` | 255 | 1 | 1 | tout |

MESURÉ avant d'écrire : RLS sans policy renvoie 0 à `anon` et `authenticated`,
et `service_role` (BYPASSRLS chez Supabase) continue de tout lire — **la reprise
n'est donc pas gênée**.

**OUBLI RÉPARÉ : le schéma `config` était entièrement vide.** Le 28/08 j'ai
écrit « les référentiels sont amorcés » : c'était vrai de `ref` et de `ref`
seulement. Sept des huit tables de `config` avaient une source au miroir et
n'avaient jamais été chargées — branding, asset, paramètre, 2 canaux Slack,
4 modèles d'e-mail, 6 gabarits SendGrid et les **7 liaisons** issues de
l'éclatement de la chaîne à pipe. `config.integration` reste vide, et c'est
correct : elle n'a aucune source. Constaté en vérifiant que le job board
pouvait lire le logo.

### AUDIT DE COHÉRENCE — 08/09/2026

Modèle rejoué depuis une base vierge, puis interrogé sur sept points.

| contrôle | résultat | verdict |
|---|--:|---|
| tables sans clé primaire | 0 | passe |
| liens `*_id` non contraints | 2 | voulus — le journal, polymorphe par construction |
| tables isolées du graphe | 7 | voulues — config autonome + les 2 tables référencées par valeur |
| cascades de suppression de profondeur ≥ 3 | 0 | passe |
| colonnes obligatoires non alimentables | 0 | passe — vérifié sur la production, colonne par colonne |
| **clés étrangères sans index** | **57** | **corrigé** |
| **types énumérés jamais employés** | **1** | **corrigé** |

**Défaut 1.** PostgreSQL n'indexe pas le côté enfant d'une clé étrangère.
Effacer un collaborateur déclenchait un balayage complet de `core.note` et de
ses ~50 900 lignes, quinze fois de suite. Les 57 index sont posés ; le modèle
passe de 244 à **301 index**.

**Défaut 2.** `ref.role_utilisateur` n'était employé par aucune colonne — la
Décision 4 a éclaté la notion entre `app.portail` et `app.role_interne`. Type
supprimé, correspondance **repointée** vers les vraies destinations plutôt
qu'effacée.

**Le modèle est cohérent au sens structurel du terme.** 64 tables, 831
colonnes, 36 énumérés, 141 clés étrangères, 113 CHECK, 301 index, et 14
migrations qui rejouent l'ensemble depuis zéro.

### Les référentiels sont amorcés — contrôle de non-perte à zéro

**60 618 valeurs de données contrôlées, 0 orpheline.** Toute valeur de
référentiel employée par le miroir a sa traduction dans `ref.correspondance`,
qui compte 558 entrées et constitue la seule preuve d'audit une fois Bubble
éteint.

Le générateur vit dans `backend/database/amorcage/` : il LIT la production,
n'y écrit jamais, et se régénère.

**UN SECOND RÉFÉRENTIEL DÉTRUIT.** Le balayage systématique des 47 tables
`ref_*` — fait pour ne pas les découvrir une par une — en a trouvé deux, et
deux seulement : `ref_tag_job` (74 lignes) et **`ref_process_etape`** (70
lignes), toutes deux portant un seul caractère par ligne. La seconde est la
plus grave : c'est le pipeline de recrutement, utilisé par 7 239 candidatures.
Concaténée, elle donne `{"display:⚡️ Acnt,_veoukbwmhr#E86F9g5D}OLB📩T301…`.
Le vocabulaire des 14 étapes est reconstruit depuis `process.etape`, et
`est_ko` se déduit du préfixe. **Mais l'ordre, les couleurs, les libellés
publics et 4 des 5 drapeaux sont définitivement perdus.**

⚠ **L'ORDRE DES 14 ÉTAPES EST PROPOSÉ, PAS MESURÉ** — c'est l'entonnoir de
recrutement usuel, de « To contact » à « Hired » puis les quatre KO. À
confirmer avant d'ouvrir le kanban : le `sort_order` d'origine est parti avec
la table.

*Faux positif de mon balayage* : `ref_maturite_produit` porte légitimement des
valeurs d'un caractère (A à E).

**Une collision de slug rattrapée avant d'être posée.** `C#` et `C++` se
réduisaient tous deux à `c` — la jonction `expertise_univers` en perdait une
ligne, silencieusement, puisqu'elle s'insère par `select`. Le slugifieur
translittère désormais les symboles porteurs de sens, et la jonction réutilise
le code réellement attribué au lieu de le recalculer.

**19 valeurs découvertes en données**, absentes de leur référentiel : 17
métiers saisis au clavier par les recruteurs (« Founding Engineer »,
« Head of RSSI », « Staff Product Manager »…) et 2 expertises
(« Intégrations », « UX/UI »). Elles portent `origine = 'decouvert_en_donnees'`,
ce qui les distingue pour toujours du vocabulaire officiel. Sans elles, les
clés étrangères auraient rejeté ces lignes à la reprise.

### Trois corrections issues de la mesure, le 28/08/2026

**Les unités du placement sont tranchées.** Le détail avertissait qu'une
erreur d'unité y fausserait tout le reporting. Deux preuves l'ont réglée :
le ratio commission/salaire a pour médiane **0,200** sur 144 couples, soit
exactement les 20 % d'honoraires — même unité, donc K€ ; et sur les 3 lignes
non nulles, **`apport_affaires_k` vaut exactement `commission − commission_nette`**,
à l'euro près. C'est donc un montant en K€ et non un pourcentage, malgré une
magnitude de 1,6 à 1,9. Les deux TJM sont en €/jour. Seul
`montant_cooptation_talent` reste non tranché : 21 valeurs dont 18 à zéro, les
trois autres étant 1, 250 et 350 — en K€ ce serait absurde, en € le « 1 » est
douteux. Décision métier. Tout cela est inscrit en commentaires de colonnes
dans la base.

**`public.ref_tag_job` est DÉTRUIT.** Le détail annonçait « 74 tags » et
signalait qu'une valeur, « Job exclu », n'avait jamais existé au référentiel.
La réalité est plus grave : la table contient 74 lignes portant **chacune un
seul caractère**, avec un `sort_order` allant jusqu'à 1899 ; concaténées, elles
donnent les débris d'une chaîne `"display:🌱 Cronce,/3.mz…` explosée caractère
par caractère. Aucune des 16 valeurs réellement utilisées n'y figure. Le
vocabulaire est intégralement reconstructible depuis les 833 lignes de
`public.mandat_tag_job` — 16 valeurs, de « 🐓 Boîte FR » (152 mandats) à
« 🦄 Licorne » (1). À noter : « Job exclu » est le seul sans emoji ET le seul
qui ne décrive pas un attrait du poste — c'est un drapeau d'exclusion, à
arbitrer.

**Les 4 lignes qui bloquent les contraintes différées sont identifiées :**

| table | identifiant Bubble | anomalie |
|---|---|---|
| mandat | `1781189139395x704349075949454600` | « Prose-D7-Tech-ML Engineer » 100 → 90 K€ |
| mandat | `1782896149946x785055806356417700` | « Weda-D1-Product-PM » 75 → 60 K€ |
| mandatclose | `1739175126740x105991091207012350` | début 2024-10-31, fin 2024-05-30 |
| mandatclose | `1768310322374x150689603750985730` | closing 2026-01-13, garantie 2025-12-18 |

### Ce qui reste

1. **`core.vivier_mandat`** — la seule table manquante, en attente de sa
   définition métier.
2. **Les vues `api`** — inutiles tant que `public`, `pivot`, `avant_garde` et
   `avant_garde_dev` restent exposés dans le tableau de bord Supabase.
3. **La reprise des données** elle-même.

À poser APRÈS le chargement, et jamais avant : les 3 CHECK refusés par la
mesure, les 2 contraintes `NOT VALID` du domaine entreprise, et le
déclencheur `compte_a_un_acces` — sa fonction existe, le déclencheur non.

13 tables : mandat / candidature / placement (11) et note / tâche (2).
**Six colonnes attendent encore leur clé étrangère** — quatre seront posées par
la migration mandat (`mandat_contact_client.mandat_id`, `tag.mandat_id`,
`enquete_nps.mandat_id` et `.placement_id`), deux par la migration `app`
(`fiche_talent.cree_par_compte_id`, `fiche_talent_tag.pose_par_compte_id`).

Un seul arbitrage bloque encore une table : la définition métier de
`core.vivier_mandat`.

16 tables : personnes internes (3), mandat / candidature / placement (11),
note et tâche (2). Deux arbitrages bloquent des tables précises sans empêcher
le reste : la définition métier de `core.vivier_mandat`, et la version stricte
ou tolérante de `core.apporteur_affaires`.

22 tables : entreprise et contacts, mandat / candidature / placement,
personnes internes, note et tâche. Deux arbitrages bloquent des tables précises
sans empêcher le reste : la définition métier de `core.vivier_mandat`, et la
version stricte ou tolérante de `core.apporteur_affaires`.

Deux arbitrages bloquent des tables précises, pas l'ensemble : la définition
métier de `core.vivier_mandat`, et la version stricte ou tolérante de
`core.apporteur_affaires`. Les autres tables de `core` peuvent s'écrire.

### Hors modèle, toujours en attente

Retirer `public`, `pivot`, `avant_garde` et `avant_garde_dev` des schémas
exposés dans le tableau de bord Supabase. Tant que ce n'est pas fait, la
couche `api` est contournable — action manuelle, pas une migration.

---

## Où on en était, au 26/08/2026

**La faille des RPC est fermée, sur les deux projets.** La clé publique se voit
refuser les 7 fonctions du schéma `public` — dont `truncate_data_tables`, et
`enable_fk` qui s'exécutait vraiment. Avant/après mesuré de l'extérieur, synchro
vérifiée en fonctionnement après la migration. Détail et les deux pièges
rencontrés : **`docs/SECURITE_RPC.md`**.

⚠️ Le script `Bubble migration/URGENT_revoquer_rpc_publiques.sql` est **périmé**
et ne doit pas être rejoué : sa troisième partie, censée protéger les fonctions
futures, est sans effet — `ALTER DEFAULT PRIVILEGES … REVOKE FROM PUBLIC` ne
retire pas le droit câblé de PostgreSQL. Mesuré. La protection passe désormais
par un déclencheur d'événement, dans la migration
`supabase/migrations/20260826072934_revoquer_execution_publique.sql`.

**Un environnement de développement existe.** Second projet Supabase,
`Pacha-App_dev` (`xavnvkpgbpczblmwlaxk`), avec la structure exacte de la
production et 369 730 lignes anonymisées. 659 vraies valeurs cherchées dedans,
aucune retrouvée. Tout est dans **`docs/ENVIRONNEMENT_DEV.md`**.

```
npm run cible        # sur quoi chaque morceau est branché, et les contrôles
npm run cible:dev    # basculer l'application sur le dev
```

⚠️ **Vérifier `supabase/.temp/project-ref` avant toute commande qui écrit.** La
CLI n'est rattachée qu'à un projet à la fois, et `db push` s'applique à celui-là.

**Le schéma réel de la production est capturé** dans
`supabase/migrations/20260825111210_remote_schema.sql`, vérifié par rejeu et par
`supabase db diff`. Les 21 colonnes que plus aucun fichier ne décrivait sont
dedans. **Ne plus jamais modifier la base à la main dans l'éditeur SQL** : toute
évolution passe par une migration, appliquée au dev puis au live.

**Décision associée toujours en attente** : rotation de la clé service_role, qui
a circulé dans les scripts du dossier de migration.

---

## Partie 1 — la base talent unifiée

**Ce qui tourne.** Le pivot est vivant pour la source app : **30 972 dorés**,
98 exécutions du connecteur, une toutes les 15 minutes via n8n. Identité,
contacts, **37 068 notes**, 5 858 attentes, 6 621 qualifications, 1 227 conflits
journalisés. Idempotent et réversible, prouvé par test.

**Ce qui manque.** La source `ats` est en `jamais_lance`. Le connecteur Jarvi est
écrit et testé, il manque le premier chargement.

Détail complet : **`docs/PHASE1_RESTE_A_FAIRE.md`**

### Le premier chargement Jarvi, en une page

- **Le verrou** : tant que le curseur `ats` est vide, aucun incrémental n'est
  possible — le connecteur lirait tout.
- **La contrainte** : la limite de débit de Jarvi (5 min de calcul par heure)
  ne s'applique **que du lundi au vendredi, 07:00–18:00 UTC**. Hors de là,
  aucune limite. Une lecture complète demande 268 requêtes, donc plus que le
  budget d'une heure ouvrée → **à lancer après 18:00 UTC ou le week-end**.
- **Où on en est** : comparaison à mi-chemin, 16 200 profils sur 26 724 lus et
  sauvegardés dans `var/connecteurs/comparaison_jarvi.json`. La reprise repart
  seule de l'offset 16 200 — il reste 106 requêtes.
- **Ce qu'on sait déjà** : sur les 16 200 plus anciens, **16 197 sont déjà dans
  le pivot**. Le rattrapage sera une mise à jour, pas une création massive.
- **Ce qu'on ne sait pas** : les 10 524 non lus sont les plus **récents**, donc
  les plus susceptibles d'être nouveaux. Le taux mesuré est un plancher, pas une
  estimation.

Commandes :
```
cd pachamama-os && PYTHONPATH=backend/api/src backend/api/.venv/bin/python \
  -m pachamama_api.connecteurs.jarvi_pivot              # simulation
  -m pachamama_api.connecteurs.jarvi_pivot --appliquer  # écriture
```

---

## Partie 2 — l'application

**L'état réel** : le design system est fait (25 composants, 252 icônes,
contrastes mesurés), les vues Talent, Entreprise, Job Board et Fiche d'offre
sont construites — mais **rien ne lit la base**. Tout tourne sur trois fichiers
de fixtures. `recruteur` et `backoffice` sont des pages de 10 lignes.
**Aucune policy RLS n'existe.**

**Le modèle de données a été revisité avant de commencer**, et c'est le gros du
travail du 26/08. Le décalque de Bubble n'est pas un modèle : 34 des 113 liens
tenus par une contrainte, 102 clés primaires en texte sans valeur par défaut,
et seulement **109 colonnes sur 688 qui traverseraient inchangées**.

L'étude complète est faite — les 688 colonnes attribuées une par une, couverture
vérifiée indépendamment — et les décisions sont prises. **Tout est dans
`docs/decisions/0003-modele-donnees-application.md`**, qui se lit seul : la
forme du modèle, les six décisions par domaine, ce qui change, et ce qui reste
ouvert. Les données de l'étude sont dans `backend/database/modele_cible/`.

Les deux points qui bloquent l'écriture du modèle y sont marqués `OUVERT` : ce
que la fiche talent porte que le pivot n'a pas, et l'extension de la provenance
par champ dans le pivot — `attentes` n'en a aucune, ce qui rend inapplicable la
règle « la parole de la personne prime ».

**Le découpage est fait** : 7 jalons, ordonnés par risque d'accès croissant.
Chaque jalon ouvre un seul type d'accès et livre le test qui prouve que les
autres restent fermés.

| | Jalon |
|---|---|
| J1 | Job Board public sur données réelles |
| J2 | Authentification, rôles et rattachement des comptes |
| J3 | Portail Entreprise |
| J4 | Espace Talent |
| J5 | Poste Recruteur : consultation |
| J6 | Poste Recruteur : actions, et préparation du Chasseur |
| J7 | Back-office de gouvernance |

- Vue d'ensemble et décisions tranchées : **`docs/DECOUPAGE_PHASE2.md`**
- Tickets prêts à coller dans Notion : **`docs/tickets/`** (un par jalon)

Trois faits mesurés qui contraignent le J1 : publier les 34 mandats marqués
`public` mettrait **21 postes déjà pourvus** sur la seule page indexable (seuls
12 sont publiables) ; le champ `titre` ne doit **jamais** être publié, car les
13 mandats publics et ouverts sont tous anonymes et **13 sur 13 portent le nom
du client dans leur titre** ; et `ref_process_etape` est **corrompue** — 70
lignes de caractères isolés, `is_public` vrai sur zéro ligne — alors que c'est
elle qui doit décider ce qu'un client a le droit de voir.

---

## Partie 3 — le Chasseur de Talents

Pas commencé, et c'est normal : il vient en dernier. La vue Recruteur (J5-J6)
**est** son interface.

---

## Où vit quoi

- **`pachamama-os/`** — dépôt **public** sur GitHub. Code, docs, tickets.
  Rien de sensible. `.env.local` est ignoré par git (vérifié).
- **`Bubble migration/`** — **pas un dépôt git**. Scripts d'exploitation avec
  clés en dur, `.env`, exports bruts, fichiers à données personnelles.

Les connecteurs vivent dans `backend/api/src/pachamama_api/connecteurs/` :
`commun.py` (config, HTTP, dates), `moteur.py` (la cascade, une seule fois),
`app_pivot.py`, `jarvi.py`, `jarvi_pivot.py`, `annuler_run.py`.

Le nœud n8n est un **portage temporaire** du Python, qui reste la référence.
Règle écrite dans `connecteurs/__init__.py` : toute correction se fait dans le
Python d'abord, puis se reporte.

---

## Ce qui attend une décision de votre part

- la **révocation des RPC** et la rotation de la clé service_role ;
- **où tourne la synchro Jarvi** ensuite : portage n8n, appel à FastAPI, ou
  Python planifié. Recommandation : **une fois par nuit**, ce qui fait
  disparaître définitivement la contrainte de quota ;
- les **deux appréciations de personnalité** et un contact nominatif (adresse retirée du dépôt public),
  seuls arbitrages humains de la purge des fantômes ;
- l'état du **PITR Supabase**, illisible avec la clé service_role ;
- l'**accord des 12 clients** avant publication de leurs offres (J1) ;
- ce qui doit être **démontrable pour la soutenance** du Bachelor, et à quelle date.

---

## Les règles apprises, qui doivent survivre

**Un contrôle mal écrit ment dans les deux sens.** Chercher une clé API par ses
24 premiers caractères revient à chercher l'en-tête d'un JWT, identique pour
toutes les clés Supabase — trois faux positifs. Et une alternative écrite `\|`
au lieu de `|` en expression régulière étendue cherche une barre verticale
littérale — un faux négatif. Un contrôle qui crie à tort cesse vite d'être cru,
et c'est aussi grave qu'un contrôle muet.

**Un réglage par défaut ne se retire pas toujours.** `ALTER DEFAULT PRIVILEGES
… REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` est sans effet : le droit câblé de
PostgreSQL revient sur toute fonction créée ensuite. Vérifié sur PostgreSQL 17,
y compris sur une base vierge. La seule prévention est un déclencheur
d'événement.

**Le miroir est déjà lossy.** Le champ Bubble `Actif`, rempli à 100 % sur 6 783
candidats, n'a jamais été synchronisé. La référence de non-perte n'est donc pas
le miroir, c'est Bubble. Et comparer des noms Bubble à des noms de colonnes ne
prouve rien : la synchro renomme.

**Une variable CSS ne se résout pas dans un attribut SVG**, et un hex figé ne
peut pas être lisible sur fond clair *et* sombre. Les couleurs d'une figure
passent par des classes pilotées par les jetons de thème.



Elles sont toutes payées par un incident réel de ce projet.

**Mesurer en production, jamais dans un fichier.** Les `.sql` du dépôt ne
décrivent pas l'état de la base : `drop_fk_metier.sql` a été appliqué
partiellement, et deux analyses successives se sont trompées en le lisant.

**Un résultat vide n'est pas une preuve.** Sous clé `anon`, `mandat` et
`candidat` renvoient 200 avec un tableau vide — pas une erreur. Une policy
manquante est indiscernable d'une base vide. Tout contrôle doit aussi affirmer
un compte attendu **non nul**, sinon il passe au vert sur une panne.

**Les lectures sont tronquées en silence.** PostgREST plafonne à 1 000 lignes
quel que soit le `limit` demandé ; l'API Jarvi plafonne à 100 alors que sa
documentation annonce 1 000. Toute lecture doit être recoupée avec le total
annoncé.

**Un filtre non compris est ignoré.** Chez Jarvi, un opérateur inexistant rend
un résultat plausible mais faux. Tout filtre se valide par contre-épreuve : il
doit restreindre, et un filtre impossible doit rendre zéro.

**Les dates mentent.** PostgREST supprime les zéros de fin des fractions de
seconde, et `datetime.fromisoformat` refuse 1 ou 2 décimales avant Python 3.11.
Un parseur naïf a annoncé 4 150 fiches périmées inexistantes. Tous les scripts
auto-testent leur parseur et refusent de produire un chiffre s'il échoue.

**Ne jamais avancer un curseur sur exception**, et le reculer d'une milliseconde
sur succès — la comparaison stricte exclut sinon les ex æquo.

**Persister l'état à chaque page.** Une coupure a coûté 10 000 profils et une
heure d'attente ; la même coupure, après correction, n'a rien coûté.

**Une règle métier écrite deux fois divergera.** Le bug `employeur_actuel_src`
a survécu parce qu'il n'était corrigé que d'un côté. D'où `moteur.py`.

**Une clé d'identité doit être une vraie identité.** `linkedin.com`, `test`,
`bit.ly/…` servaient de clés de rapprochement : trois dorés fusionnaient des
personnes distinctes. Seul un chemin `/in/<slug>` est désormais accepté.
