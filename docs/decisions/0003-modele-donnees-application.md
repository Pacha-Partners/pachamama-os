# ADR 0003 — Le modèle de données de l'application

**Statut** : **en cours** — les décisions ci-dessous sont prises, le modèle
n'est pas écrit · **Date** : 26/08/2026 · **Portée** : Phase 2, avant le jalon 1

Trois marqueurs balisent ce document, et il faut les respecter à la relecture :

- **TRANCHÉ** — décidé par Claude Menye au cours de la séance du 26/08.
- **PROPOSÉ** — ma recommandation, non confirmée. À valider avant d'écrire.
- **OUVERT** — sans réponse, et bloquant pour la partie concernée.

## Contexte

Le schéma `public` est un décalque de Bubble : 107 tables pour dix concepts
métier, 34 des 113 liens tenus par une contrainte, 102 clés primaires en texte
sans valeur par défaut. Il n'a jamais été conçu comme un modèle — c'est une
copie fidèle, et il doit le rester tant que Bubble tourne.

L'application a donc besoin de son propre modèle. Il doit reproduire ce que
Bubble fait, permettre ce qui est nouveau, et se laisser alimenter par le
miroir pendant la transition — jusqu'au jour où Bubble s'arrête et où le
miroir n'a plus d'utilité.

## Les mesures qui fondent tout ce qui suit

Prises en production les 25 et 26/08. Elles évitent d'avoir à re-mesurer.

| | |
|---|---|
| colonnes du miroir, toutes attribuées | 688 |
| qui traversent inchangées | 109 (16 %) |
| liens entité→entité tenus par une contrainte | 34 sur 113 |
| clés primaires en texte sans valeur par défaut | 102 sur 107 |
| talents au pivot · fiches côté app | 30 973 · 7 023 |
| talents avec un compte | 4 156 (13 %) |
| `equipe` : lignes · personnes distinctes | 768 · 427 |
| contacts intervenant pour plusieurs entreprises | 2 |
| contacts qui sont aussi candidats | 11, dont **8 sans compte** |
| correspondances contact↔candidat par le nom, non vérifiées | 131 |
| apporteurs d'affaires qui sont des candidats | 15 sur 20 |
| comptes rattachés à rien | 104, pour 41 rôles internes |
| répartition des rôles | 4 211 candidats · 345 entreprise · 41 internes |
| lignes de qualification au pivot | 6 621 |
| talents sans fiche | ~24 000 sur 31 000 |
| `user.auth_id` rempli | 0 sur 4 605 |
| champ Bubble `Actif`, rempli à 100 %, synchronisé | **jamais** |
| colonnes de provenance dans `pivot.attentes` | **0** |
| candidatures finissant par un KO, motif enregistré | 87 %, **nulle part** |

---

---

# Partie A — La forme du modèle

## Les 97 entités, en trois couches à ne pas confondre

817 attributs, cinq espaces de noms. Les mélanger reviendrait à bâtir 97 tables
pour un jalon 1 qui en demande quatre.

| couche | entités | rôle | remplace, dans le miroir |
|---|---:|---|---|
| `core` | 34 | le métier | les 107 tables |
| `ref` | 15 | les référentiels, code **et** libellé | les 47 tables `ref_*` |
| `config` | 8 | paramétrage, modèles d'e-mail, intégrations | ce que le miroir mêlait aux référentiels |
| `app` | 35 | ce que l'application possède | rien |
| `sync` | 4 | la tuyauterie de transition | les tables `_sync_*` |

**Ce que la migration doit porter — 57 entités** : `core` + `ref` + `config`.
C'est le périmètre qui reproduit Bubble sans perte, et celui qu'il faut
modéliser au champ près.

**Ce que l'application possède, jalon par jalon — 35 entités `app`.** Quatre
suffisent aux jalons 1 et 2 : `mandat_publication`, `compte`,
`journal_ecriture`, `idempotence`.

**Ce qui est feuille de route, nommé mais pas construit** : `embedding`,
`score_fit`, `agent_run`, `agent_step`, `agent_result`,
`conversation_assistant` — issus des fonctionnalités d'IA. Les nommer évite de
rouvrir le modèle plus tard ; les construire maintenant serait de la
spéculation.

**Et `sync` ne suit pas** : cette tuyauterie meurt avec le miroir.

## L'ossature de `core`

```
core.entreprise ──1-N──> core.mandat ──1-N──> core.candidature ──1-N──> core.placement
                                                     ↑
                                                core.talent
```

Un client confie une mission ; la mission reçoit des candidatures ; une
candidature aboutit à un placement. **Le talent s'accroche à la candidature**,
parce que c'est elle qui *est* la rencontre — 1,74 candidature par talent
jusqu'à 26, 15,3 par mandat jusqu'à 240.

Sur les 34 entités `core`, **quinze portent de la substance** et dix-neuf sont
de vraies tables de liaison :

| entité | attributs | ce qu'elle absorbe du miroir |
|---|---:|---|
| `talent` | 67 | quatre tables repliées : `candidat_expanded`, `experience`, `job_actuel`, `job_reve` |
| `mandat` | 63 | la table la plus large du décalque |
| `entreprise` | 50 | plus `entreprise_remote` replié |
| `tache` | 32 | `task_notif` replié |
| `candidature` | 30 | — |
| `placement` | 29 | l'ex-`mandatclose` |
| `note` · `repartition_commission` | 22 | — |
| `contact_client` · `utilisateur` | 17 | — |
| `enquete_nps` 15 · `apporteur_affaires` 11 · `tag` 10 · `analyse` 8 · `produit` 8 | | |

⚠️ `candidature → placement` est *presque* du 1 pour 1 — 226 valeurs non nulles
pour 224 distinctes. **Ne pas poser de contrainte d'unicité** : elle casserait
sur les deux doublons.

## À quoi sert `api`, concrètement

`api` est **le modèle de l'application**, pas `app`. Trois rôles.

**Il définit ce que l'application connaît.** Le code ne lit jamais `public` ni
`pivot` : il lit une dizaine de vues dont chaque colonne a été choisie. C'est
ça qu'il faut modéliser avec précision.

**Il porte la frontière de sécurité.** Seul schéma exposé au navigateur, vues
en `security_invoker` pour que la RLS des tables s'applique vraiment, colonnes
énumérées pour qu'une colonne ajoutée demain par la synchro ne puisse pas se
retrouver publiée sans décision.

**Il absorbe la forme de Bubble.** Une vue recolle les cinq tables 1 pour 1 du
candidat en une ligne et traduit `🙅🏻‍♀️ KO by Pachamama` en valeur stable. Un
libellé renommé dans Bubble se corrige à un endroit, pas à cinquante.

## Les conventions du schéma cible · TRANCHÉ

Chaque règle répond à un défaut mesuré — sans quoi ce ne seraient que des
préférences.

| règle | le défaut qu'elle corrige |
|---|---|
| clé primaire `uuid` avec `default gen_random_uuid()` | 102 des 107 clés du miroir sont du texte **sans défaut** : l'application ne peut pas créer une ligne |
| `bubble_id text unique`, facultatif — une **provenance**, pas une clé | le pivot rattache les 7 028 talents de l'app par leur identifiant Bubble ; aucune clé ne doit en dépendre, pour que le cut ne casse rien |
| une entité, une table — aucun satellite 1 pour 1 | cinq jointures pour afficher une personne |
| tout lien est une clé étrangère avec un `on delete` explicite | 34 liens tenus sur 113 |
| un référentiel porte un **code** et un **libellé**, jamais le libellé comme valeur | `process.etape` stocke `🙅🏻‍♀️ KO by Pachamama` comme valeur : un renommage casserait un filtre, et pire une policy |
| les types disent ce qu'ils sont | des salaires en `integer` ont gelé la synchro 43 jours |
| nommage français, table au singulier, `_id` réservé aux clés étrangères | le miroir mêle `cand_firstname`, `os_language`, `_del_Statut`, `job_rêve` |
| `cree_le` et `maj_le` posés par l'application | `created_at` du miroir est une date de **synchronisation** |
| un drapeau `actif` seulement où le métier en a besoin | le chantier des flags `Actif` a coûté cher faute de règle |

## Les quatre façons de relier deux tables

**Un X appartient à un Y.** La table enfant porte l'identifiant du parent. La
colonne est toujours du côté du « plusieurs ».

**Deux X se rencontrent, et la rencontre devient une chose.** Un talent et un
mandat se rencontrent : cette rencontre *est* la candidature, avec ses trente
attributs. Ce n'est pas un trait, c'est une entité.

**Un X porte plusieurs valeurs d'une liste.** Une table à deux colonnes.
Dix-neuf dans le modèle — la seule chose que le décalque faisait à peu près
juste.

**Un X se rattache à plusieurs sortes de choses.** La note, vers un talent, une
entreprise, un mandat ou un placement. **PROPOSÉ** : quatre colonnes
contraintes plutôt qu'un couple générique — la base peut vérifier quatre liens,
elle ne peut pas vérifier un couple « type + identifiant ».

---

# Partie B — Les décisions, domaine par domaine

## Décision 1 — Quatre schémas, une règle chacun · TRANCHÉ

| schéma | contenu | qui écrit | exposé à l'API |
|---|---|---|---|
| `public` | le miroir de Bubble | la synchro n8n, seule | oui (héritage) |
| `pivot` | la base talent unifiée | les connecteurs, seuls | oui (héritage) |
| `app` | ce que l'application possède | l'application, seule | **non** |
| `api` | **des vues, rien d'autre** | personne | **oui, et lui seul compte** |

Trois interdits en découlent : aucune migration applicative ne modifie
`public` ; aucune écriture applicative ne va dans `public` ni `pivot` ; `api`
ne contient que des vues à colonnes énumérées, en `security_invoker`.

**`api` est le modèle de l'application**, pas `app`. Le code ne lit jamais les
tables : il lit une dizaine de vues dont chaque colonne a été choisie. C'est
là que se joue la sécurité, et c'est ce qui absorbe la forme de Bubble.

**`app` est un complément, pas un modèle.** Une donnée n'y va que si aucun
schéma ne la porte *et* si la synchro l'écraserait ailleurs. Chaque table
ajoutée est une petite dette : un endroit de plus où la vérité habite.

### Pas de clé étrangère de `app` vers `public` · TRANCHÉ

`public` est réécrit par la synchro, et `truncate_data_tables()` existe. En
`CASCADE`, un rechargement complet détruirait les données saisies dans
l'application ; en `RESTRICT`, il bloquerait la synchro. La référence reste une
colonne texte, **et le risque est rendu visible** par une vue de réconciliation
qui liste les orphelins. Ce n'est pas la même chose que les 79 liens non
contraints du miroir : ceux-là ne sont contrôlés par rien.

---

## Décision 2 — Trois niveaux pour le talent · TRANCHÉ

C'est la décision la plus structurante, et elle corrige une erreur de ma
première proposition.

```
pivot.talent        ce que NOUS avons assemblé      31 000   ne se montre jamais
core.talent         projection du pivot dans l'app  31 000   LECTURE SEULE
core.fiche_talent   l'enregistrement de l'app        7 000   le seul modifiable
```

**La règle : `core.talent` ne s'écrit jamais depuis l'application.** Tout ce
qu'un recruteur ou un candidat modifie va dans la fiche ; la fiche nourrit le
pivot ; le pivot rafraîchit `core.talent`. Sans cette règle, deux copies
modifiables de la même personne — le scénario le plus coûteux du projet.

`core.talent` sert à **chercher** : le poste recruteur doit fouiller 31 000
personnes sans taper dans une autre base à chaque frappe. C'est une projection,
pas une source.

### Pourquoi la séparation, et non un enregistrement unique

Dans Bubble, le talent édite déjà son profil — c'est marqué « existant, must »
au cadrage. Ce qu'il édite, ce sont les tables de l'app ; c'est le pivot qui
fusionne ensuite avec Jarvi. **Le candidat n'a donc jamais vu ce que Jarvi sait
de lui.** Cette propriété existe aujourd'hui gratuitement, parce que les deux
niveaux sont séparés.

Ma première proposition — un `core.talent` unique de 67 attributs alimenté
depuis le miroir — l'aurait détruite : il aurait fallu ensuite un filtre de
visibilité pour éviter qu'un candidat inscrit découvre tout ce qu'on a sourcé
sur lui. La fiche ne rajoute pas une couche, elle rétablit celle qui existe.

---

## Décision 3 — La fiche talent · TRANCHÉ, sauf sa composition

**Ce qu'elle est.** L'enregistrement de l'application sur une personne. Elle
naît **vide**. Un recruteur peut en créer une pour quelqu'un qui n'a pas de
compte ; le candidat peut la remplir lui-même, à l'inscription ou après.

**Quand elle existe.** Un candidat avec une fiche est un candidat en process ou
qui a créé un compte. **Environ 7 000 fiches pour 31 000 talents** : les 24 000
autres ont été sourcés depuis Jarvi et jamais travaillés dans l'application.
C'est le cas majoritaire, et il ne demande rien.

**Le pré-remplissage depuis `core.talent` est un usage normal** — le recruteur
est en contact avec le candidat, la question de la découverte ne se pose pas en
pratique. Et la fiche portera de toute façon des informations que le pivot n'a
pas.

**La qualification vit dans les deux** : portée par la fiche, poussée au pivot
comme le reste. Elle existe déjà côté pivot — `pivot.qualification`, **6 621
lignes** rattachées au talent, avec niveau, univers, anglais, profil, séniorité,
background, expertises et secteurs. C'est ce que Jarvi ne sait pas produire,
et c'est pour ça qu'elle appartient à l'application.

**Le cycle** : fiche → pivot → `core.talent` → (sur décision) fiche. Chaque
passage est un acte, jamais un automatisme.

**La préséance est le travail du moteur d'inclusion**, qui existe déjà et devra
être étendu.

### Une fiche par talent, garanti par la base · PROPOSÉ

Contrainte d'unicité sur `fiche_talent.talent_id`. Le raisonnement « le
recruteur est en contact avec le candidat » tient pour le fonctionnement
courant, mais le job board est **public et indexable** : quelqu'un peut
candidater à froid sans qu'aucun recruteur ne l'ait eu au téléphone. La
contrainte ne coûte rien et couvre ce cas.

Le lien est **facultatif** : une fiche créée à l'inscription n'a pas encore de
`talent_id`, le pivot ne l'a pas ingérée. Il se remplit au premier passage du
connecteur.

### Provenance par champ · PROPOSÉ, et la mesure l'impose

Pour que le moteur puisse faire primer la parole de la personne, la fiche doit
dire **qui a rempli chaque champ** : la personne, un recruteur, ou un
pré-remplissage.

Et la mesure montre que le pivot ne sait pas le faire non plus : il porte
quatre colonnes de provenance sur `talent` — prénom, nom, localisation,
employeur — et **zéro sur `attentes` et `qualification`**. Or `attentes` est
exactement là où vit la parole du candidat : job rêvé, salaire souhaité,
disponibilité, no-go. **La règle n'est donc pas implémentable en l'état**, sur
les champs où elle compte le plus. C'est une extension à faire dans le pivot.

### Historique et origine des modifications · TRANCHÉ dans le principe

Deux besoins distincts, que confondre coûterait cher.

**La provenance courante** répond à « qui a posé la valeur qui est là ». Le
moteur d'inclusion la lit à chaque passage pour arbitrer entre la fiche et
Jarvi : il lui faut une réponse immédiate, sur 7 000 fiches, sans rien
reconstituer.

**L'historique** répond à « qu'est-ce qui a changé, quand, par qui, depuis
quelle valeur ». C'est une trace, lue par un humain.

Le premier est un état, le second un journal. Dériver l'état du journal serait
lent et fragile — un journal purgé effacerait la préséance.

#### Les cinq origines

| origine | ce que ça veut dire |
|---|---|
| `déclaré` | la personne elle-même, depuis son espace — **celle qui prime** |
| `recruteur` | un collaborateur a saisi la valeur |
| `pré-rempli` | tiré de `core.talent`, donc de ce qu'on avait assemblé |
| `import` | depuis un CV ou LinkedIn — prévu au cadrage comme nouveauté |
| `automatique` | une action du système, sans auteur humain |

⚠️ **La granularité du pré-remplissage est plafonnée par ce que le pivot sait.**
Il ne connaît la source que de quatre champs — prénom, nom, localisation,
employeur. Pour tout le reste, la fiche ne pourra noter que « pré-rempli depuis
la base talent », sans distinguer Jarvi de l'app. Même manque que celui déjà
signalé comme bloquant.

#### La forme · PROPOSÉ

**Un seul journal, pas deux.** L'historique de la fiche passe par
`app.journal_ecriture`, qui existe déjà au modèle et que les jalons 4, 6 et 7
exigent. Une vue le filtre pour l'affichage. Deux mécanismes de journalisation
divergeraient — c'est la leçon du bug `employeur_actuel_src`.

```
app.journal_ecriture
   entite · entite_id · champ
   valeur_avant · valeur_apres
   origine · auteur_compte_id (nul si automatique) · survenu_le
```

**La provenance courante en colonnes sur la fiche**, uniquement sur les champs
déclarables — identité, coordonnées, CV, bloc attentes. Une quinzaine de
colonnes `_origine`, dans l'esprit des `_src` du pivot. Pas soixante : seuls
comptent les champs où la règle mord.

**L'origine de la création sur la fiche** : `cree_par_origine` et
`cree_par_compte_id`. Une fiche née d'une inscription et une fiche créée par un
recruteur ne se lisent pas pareil.

#### Trois conséquences · OUVERT

**Le journal porte des données personnelles** — `valeur_avant` et
`valeur_apres` contiennent noms, salaires, appréciations. Il entre donc dans le
périmètre du droit à l'effacement **et dans celui de l'anonymisation de la base
de dev**. C'est typiquement ce qu'on oublie.

**L'effacement doit emporter l'historique.** Le pivot a tranché ainsi pour
`conflit`, en qualifiant son `ON DELETE CASCADE` de « décision de conformité
avant d'être une décision d'intégrité ». Même raisonnement.

**L'historique se montre-t-il au candidat ?** « Le recruteur a changé votre
prétention de 60 à 55 » ouvre une conversation qui n'est pas toujours celle
qu'on veut. Décision de produit, à prendre avant d'exposer la vue.

### OUVERT — que porte la fiche que le pivot n'a pas ?

C'est ce qui détermine sa forme, et je ne peux pas le déduire. Si la fiche est
le pivot plus quelques champs, c'est une projection enrichie. Si elle porte des
choses d'une autre nature — documents, consentement, disponibilité négociée,
éléments de process — c'est une entité à part entière, et la question de ce qui
remonte au pivot se pose champ par champ.

---

## Décision 4 — Comptes et personnes sont deux choses · TRANCHÉ

Le décalque confond les deux : `user` porte 4 601 lignes dont **91,6 % de
candidats** et 7,5 % de contacts client. Ce n'est pas la table des employés,
c'est la table de tout le monde.

Trois raisons interdisent de la reprendre : `auth_id` est vide sur les 4 605
lignes ; le miroir est réécrit toutes les quinze minutes, donc un rôle modifié
dans l'app y serait effacé ; et le vocabulaire est celui de Bubble
(« Recruiter Core Team ») quand l'application attend `talent / entreprise /
recruteur`.

### Ce que `user` contient réellement, mesuré

```
Candidat                 4 211   91,6 %
Entreprise                 345    7,5 %
Recruiter Support Crew      18    0,4 %
Recruiter Core Team         13    0,3 %
Admin                       10    0,2 %
                         ------
4 597 lignes · 4 594 personnes · 3 en portent deux
```

Quarante et une lignes de rôle interne sur 4 597. Et **104 comptes rattachés ni
à un candidat ni à une entreprise**, alors que 41 seulement portent un rôle
interne : une soixantaine de comptes sont donc sans rattachement *et* sans rôle.
À trier avant migration — c'est exactement le genre de ligne sur laquelle une
contrainte échoue.

Deux détails que la mesure sort :

**`ref_role_category` ne contient qu'une valeur, `recruiter`, et sa colonne
consommatrice est vide à 100 %.** Le concept de catégorie de rôle a été pensé
puis abandonné. Il ne passe pas dans le modèle.

**`user_partner` — 8 lignes associant un utilisateur à un univers** — se replie
dans le collaborateur. Ce n'est pas une entité.

```
core.talent          la personne candidate            31 000
core.contact_client  la personne chez un client          427
core.collaborateur   la personne chez Pachamama           ~41

app.compte           auth_id · actif
app.acces            compte → fiche | contact | collaborateur · rôle · actif
```

**Le compte porte le lien vers la personne, jamais l'inverse** : 87 % des
talents n'ont pas de compte, une colonne sur la personne serait vide neuf fois
sur dix.

**Une personne sans compte n'a aucune ligne dans `app.compte`.** C'est le cas
majoritaire, et il ne demande rien.

**Un compte sans accès est impossible** — ce qui règle les 104 comptes
rattachés à rien.

### Les rôles multiples · TRANCHÉ

Supabase Auth est indexé sur l'e-mail : **une personne a un compte et un seul**.
« Deux comptes pour la même personne » n'est pas une option qu'on écarte, c'est
une option qui n'existe pas.

D'où `app.acces` : **une ligne par contexte**. Un candidat placé qui devient
responsable de recrutement chez son nouvel employeur ajoute une ligne — rien de
ce qui existait ne bouge.

**Les droits sont accrochés à l'accès, pas à la personne.** Sans cette
séparation, une candidate devenue cliente verrait, côté client, les notes que
les recruteurs ont écrites sur elle quand elle était candidate. Avec, la fuite
est structurellement impossible.

Corollaire : **être un talent ne donne pas l'accès talent.** Une personne peut
être un contact-qui-est-un-talent et n'avoir qu'un accès entreprise.

### Deux axes de rôle, pas une énumération · PROPOSÉ

> ⚠️ **AMENDÉ le 09/09/2026 par l'[ADR 0004](0004-quatre-portails.md).** Le
> portail `interne` a été scindé en `recruteur` et `backoffice` : administrer
> et recruter sont deux surfaces, pas deux graduations d'une même surface. Le
> raisonnement ci-dessous reste valable pour `support`, qui demeure une
> graduation du portail recruteur. Trois personnes portaient déjà les deux
> casquettes dans Bubble et les perdaient à la reprise.

Les cinq valeurs actuelles mélangent deux questions. **Quel portail** —
`talent`, `entreprise`, `interne` — décide de ce qu'on voit. **Quel pouvoir à
l'intérieur du poste recruteur** — `admin`, `recruteur`, `support`, 41 lignes —
décide de ce qu'on peut faire. Les fondre rend la matrice de permissions du
jalon 6 inexprimable : « le support voit les mêmes candidatures mais ne peut
pas les modifier » n'est pas dicible avec un seul champ.

---

## Décision 5 — Le lien d'identité entre casquettes · TRANCHÉ

C'est l'héritage pressenti, et il n'est pas là où on l'attend.

Ce n'est **pas** de l'héritage au sens strict — une personne n'est pas *soit*
un talent *soit* un contact : elle **cumule**. Ce sont des casquettes.

```
core.contact_client.talent_id      → core.talent      11 cas
core.collaborateur.talent_id       → core.talent       3 cas
core.apporteur_affaires.talent_id  → core.talent      15 sur 20
```

**Le talent est l'ancre** : 31 000 lignes contre 427 et 41, et c'est lui que le
pivot sait rapprocher, avec la machinerie d'identité déjà écrite. Pas de table
`personne` partagée au-dessus de tout le monde : elle ferait payer une jointure
à chaque lecture de talent, l'entité la plus lue, pour résoudre onze cas.

**Le lien vit entre les personnes, pas par le compte.** C'est une correction
apportée en séance : sur les 11 contacts qui sont aussi candidats, **8 n'ont
pas de compte**. Faire passer le lien par `app.acces` en aurait perdu les trois
quarts.

**Le lien est facultatif dans les deux sens** : cinq apporteurs ne sont pas
candidats, la plupart des contacts non plus.

Mesuré sur l'apporteur, par deux voies indépendantes : **15 des 20 portent un
`candidat_id`**, et **15 des 18 qui ont un e-mail correspondent à un candidat**.
Trois sont aussi des contacts client. La casquette est donc la règle, pas
l'exception — et cinq apporteurs ne sont pas candidats, d'où le lien facultatif.

**L'apporteur d'affaires ne recopie plus rien.** Le décalque duplique prénom,
nom, e-mail et photo d'une personne déjà présente dans `candidat`. Il ne porte
plus que ce qui est propre à la casquette — siret, structure, conditions de
commission — et le lien vers le talent.

⚠️ Les **131 correspondances par nom** ne doivent pas être établies
automatiquement. C'est la clé faible qui a déjà fusionné des personnes
distinctes dans le pivot. La migration propose, un humain confirme, et la
décision se conserve — sinon on la repropose à chaque passage.

---

## Décision 6 — Le contact client scindé en deux · TRANCHÉ

`equipe` porte **768 lignes pour 427 personnes**, rattachées à un **mandat**.
Une même personne y figure jusqu'à quinze fois. La table mélange qui est la
personne, chez quel client elle travaille, et sur quels mandats elle intervient.

```
core.contact_client         la personne, rattachée à l'ENTREPRISE       427
core.mandat_contact_client  sa participation à un mandat                768
```

**Aujourd'hui le lien entre un compte client et sa fiche de contact n'existe
pas, et ne peut pas exister** : `equipe` porte un `email`, `user` n'en porte
aucun — l'adresse vit dans `auth.users`. Aucune colonne commune ne permet de
savoir quel compte correspond à quel contact. La migration devra le
reconstruire par l'e-mail, seul champ possible, avec la prudence due à une clé
faible.

Ce que la scission débloque : **un compte peut enfin pointer vers un contact** —
c'était impossible tant qu'il y avait quinze lignes pour la même personne, vers
laquelle pointer ? La séparation n'est pas un embellissement, c'est le
préalable ; les 122
contacts sans mandat cessent d'être orphelins ; le contact survit à la fin du
mandat, ce qu'on attend d'une relation client ; et l'interlocuteur au niveau de
l'entreprise, que le cadrage demande, devient exprimable.

Les **2 personnes intervenant pour deux entreprises** ne sont plus un cas
particulier : deux lignes de contact, deux lignes d'accès.

---

---

---

## Décision 7 — La fusion des montants · TRANCHÉ le 27/08/2026

**Le problème, trouvé par la vérification de non-perte.** Le modèle alimente les prétentions salariales depuis `public.job_reve`. Or `public.candidat` — 7 035 lignes, bien vivante — porte quatre colonnes de salaire que `candidat_expanded` n'a pas du tout, et que la v1 ne lisait donc jamais.

| couple | identiques | en désaccord | seulement dans candidat |
|---|--:|--:|--:|
| salaire_min_souhait ↔ job_reve.salaire | 1 518 | 216 | 5 |
| salaire_max_souhait ↔ job_reve.salaire_maximum | 964 | 177 | 433 |
| tjm_min_souhait ↔ job_reve.tjm_minimum | 292 | 46 | 21 |
| tjm_max_souhait ↔ job_reve.tjm_maximum | 50 | 8 | 278 |

**Décision.** Union d'abord — si l'une des deux sources est vide, l'autre l'emporte sans condition, ce qui récupère les 737 montants orphelins. Préséance au plus récent des deux `updated_at` ensuite, quand les deux sont renseignées et diffèrent.

**Pourquoi pas « job_reve est maître ».** C'était l'hypothèse naturelle, `job_reve` étant deux fois mieux rempli. La mesure la contredit : sur les 216 désaccords de salaire minimum, **`public.candidat` est la source la plus récente 167 fois, soit 77 %**. Déclarer `job_reve` maître aurait retenu la valeur périmée dans trois cas sur quatre. Écart médian entre les deux valeurs : 5 K€ — assez pour fausser un rapprochement offre/prétention, pas assez pour se voir à l'œil nu.

**Portée.** La règle vaut pour ces quatre couples. Elle ne se généralise pas : c'est une préséance par fraîcheur entre deux tables du miroir, pas la règle de préséance entre l'app et Jarvi, qui reste celle du moteur d'inclusion.

## Décision 8 — Les entités du journal et du travail · TRANCHÉ le 27/08/2026

**Le problème.** Le croisement du modèle avec les besoins fonctionnels a montré que 28 des 62 entités attendues étaient couvertes, 30 des 34 restantes relevant de fonctionnalités `nouveau` — une frontière de périmètre légitime mais non déclarée. **Quatre relevaient de fonctionnalités déjà en production** et n'avaient aucune cible : `note`, `task`, `task_notif` et la surveillance de la synchronisation. Le compte de « trois entités non couvertes » annoncé précédemment était faux sur le nombre et sur la composition : `decision_client` est une fonctionnalité nouvelle du portail entreprise, tandis que `task_notif` et la surveillance sont vivantes aujourd'hui.

**`core.note`.** Fusionne `note` et `note_archivee`, qui ne partagent aucun identifiant — l'archivage crée une ligne neuve, à ~1 500 par mois. Rapprochées par contenu : 46 063 notes, pas 51 123. Les quatre tables de liaison sont abandonnées, `candidat_note` portant 0 ligne et les trois autres étant plus petites que les colonnes scalaires : des N-N de façade. Les 2 067 notes à trois cibles portent toujours la même combinaison, signature d'une candidature, et 98,1 % se résolvent contre `process` : elles migrent sur `candidature_id`.

**Le point bloquant de l'auteur est levé, et il ne fallait pas choisir entre les trois issues.** La Partie D posait que l'auteur des notes ne pouvait pas pointer un collaborateur — 2 103 valeurs distinctes contre 41 collaborateurs — et offrait trois issues coûteuses : passer par `app.acces` (mais 8 personnes sur 11 n'ont pas de compte), garder un texte non contraint, ou annuler la Décision 4 en reprenant 4 597 lignes dans `collaborateur`. La mesure les rend toutes inutiles. L'auteur n'est jamais quelconque : **67,8 % des notes viennent des 41 internes, 31,4 % d'un candidat, 23 notes d'un contact entreprise.** Deux clés étrangères explicites nullables — le motif déjà employé par `app.acces` — résolvent **99,25 %** des auteurs ; les 378 restants gardent leur identifiant Bubble en repli. Leçon méthodologique : la difficulté venait d'une question mal posée (« vers quelle table pointer ? ») là où il fallait d'abord mesurer qui écrit.

**`core.tache`.** 1 141 lignes, entièrement internes — la mesure ne trouve aucun créateur ni assigné hors des 41 collaborateurs, ce qui autorise des clés étrangères strictes. `task_notif` s'y replie sur une cardinalité 1:1 mesurée : 1 141 `task_id` distincts, aucune tâche à plusieurs notifications. Perte déclarée : 16 notifications orphelines.

**La surveillance n'ajoute aucune table**, mais corrige un classement erroné de ma part : les 35 colonnes `_sync_*` avaient été rangées en « tuyauterie qui meurt avec le miroir », ce qui n'est vrai que de la moitié. `pivot.sync_etat`, `sync_run`, `conflit` et les six vues `qa_*` surveillent la synchro Jarvi ↔ pivot, qui est la raison d'être du pivot et lui survit. Sans surface de lecture sur cette moitié-là, couper Bubble emporterait la supervision de ce qui reste.

# Partie C — Ce qui change par rapport au miroir

**Le chiffre qui résume tout : 109 colonnes sur 688 traversent inchangées.**
Seize pour cent. Le reste est renommé (214), retypé (97), fusionné (61), replié
(14), converti en référentiel (109) ou abandonné avec motif (84).

## Les huit corrections

| | avant → après |
|---|---|
| des clés que l'application sait créer | 102 clés en texte sans défaut → `uuid` |
| des liens garantis par la base | 34 tenus sur 113 → tous, après tri des orphelins |
| le code séparé du libellé | la valeur *est* le libellé → code + libellé |
| des types qui disent ce qu'ils sont | 97 colonnes retypées |
| les fausses relations tombent | 12 fausses N-N + 6 tables mortes |
| la configuration sort des données | webhooks et clés d'API → `config` |
| une perte réparée | le drapeau `actif`, jamais synchronisé |
| ce qui manquait pour de bon | 317 attributs à créer |

## Les 84 abandons

Treize familles, chacune mesurée : 23 artefacts de plateforme (`slug` sur 21
tables, **tous vides**), 12 clés de jointure de blocs 1 pour 1, 12 fausses N-N,
8 colonnes d'échafaudage de migration, 7 colonnes vides en production, 6 tables
de liaison mortes.

**Un abandon a été renversé** : `job_actuel.entreprise_id`, écartée comme
« doublon appauvri », porte 6 valeurs réelles. L'argument se défendait, mais
69 % des `employeur_nom` contiennent un identifiant Bubble au lieu d'un nom :
ces 6 liens sont le seul rattachement fiable quand il existe.

## Le miroir est déjà lossy — la référence change

Le champ Bubble **`Actif`, rempli à 100 % sur 6 783 candidats, n'a jamais été
synchronisé**. Zéro occurrence dans `n8n_sync_type.js`, aucune colonne dans le
DDL d'origine.

**Conséquence de méthode : la référence de non-perte n'est pas le miroir, c'est
Bubble.** Un schéma déduit du seul miroir hérite de ses pertes. L'inventaire
des 345 champs Bubble doit servir de second contrôle.

⚠️ En le faisant : comparer des noms Bubble à des noms de colonnes ne prouve
rien, la synchro renomme (`cand_firstname` → `prenom`, `num_tel` →
`telephone`). La confrontation passe par la table de correspondance de la
synchro, pas par les noms. Je m'y suis trompé une fois.

## Les manques qui portent sur des fonctionnalités déjà en production

> **Mesuré le 27/08/2026.** Sur les 264 attributs qu'exigent les
> fonctionnalités vivantes, **242 sont présents dans la v1 (92 %)**. Les 22
> absents se réduisent à six une fois écarté le littéral `id` : les quatre
> colonnes de salaire de `public.candidat` (Décision 7), et les deux drapeaux
> `popup_*`, abandonnés. Côté entités, les quatre manques sont comblés par la
> Décision 8.

Les plus urgents, parce que ce ne sont pas des nouveautés mais des choses que
Bubble fait aujourd'hui :

- `ref.etape_process` — libellés publics et drapeaux de visibilité du kanban
  client. **La table source est détruite** alors que le kanban tourne.
- `ref.tag_job` — `icone_url` perdu sur 16 tags.
- `core.mandat` — `libelle_public`, `localisation`, `departement`, `publie_le` :
  rien n'existe, et le job board en dépend.
- le drapeau `actif` sur le talent, l'entreprise et l'utilisateur.
- `app.compte` — `auth_id` et `role`.
- `core.candidature` — le motif de KO. **87 % des candidatures finissent par un
  KO et aucune colonne ne dit pourquoi.** À créer, pas à migrer.

---

---

# Partie D — Ce que le challenge du modèle a trouvé

Revue adversariale du 26/08 sous quatre angles — logique métier, cycle de vie,
accès, migration — puis **vérification de chaque affirmation chiffrée**. Deux
affirmations de la revue ne résistaient pas à la mesure et ont été écartées
(voir en fin de partie).

Arbitrage de Claude Menye en séance : les défauts qui relèvent du **moteur
d'inclusion** sont notés et traités plus tard — « à quoi sert de corriger le
moteur si la base n'est pas correcte ».

## À corriger dans le modèle, avant d'écrire du SQL

**`api` n'est pas la seule surface exposée.** Mesuré : la production expose
`public, graphql_public, avant_garde_dev, avant_garde, pivot`. Or une vue en
`security_invoker` s'exécute avec les droits de l'appelant, qui doit donc avoir
le droit sur la table de base — si cette table est elle aussi joignable par
l'API, **l'énumération des colonnes de la vue ne protège plus rien**. Un client
lirait `mandat.titre` directement, celui qu'on ne doit jamais projeter. Toute la
Décision 1 repose sur une propriété fausse aujourd'hui.

**La clé Bubble est obligatoire sur 14 entités `core`.** Mesuré dans
`correspondance.json` : `cle_legacy_bubble` est `obligatoire: true` sur talent,
mandat, candidature, placement, entreprise, contact_client, note, tache,
utilisateur, tag, produit, analyse, apporteur_affaires, repartition_commission.
C'est l'inverse de la convention posée en Partie A.

*Pourquoi cette clé existe, puisqu'on a le miroir* — question posée en séance :
elle sert **parce qu'**on a le miroir. L'import miroir → `core` doit pouvoir se
rejouer sans dupliquer ; elle permet de vérifier l'import ligne à ligne ; et
c'est elle qui porte la correspondance avec le pivot, dont les 7 028 liens
`talent_source(source='app')` sont clavetés dessus. Elle doit donc exister et
être **facultative** — nulle pour tout ce que l'application crée.

**Des colonnes rendues obligatoires rejetteraient des lignes existantes.**
`process` porte **19 lignes sans candidat, 20 sans mandat, 20 sans entreprise**.
Le cible marque `candidature.talent_id` et `mandat_id` obligatoires : la
migration échouerait. S'y ajoute le cas métier de la candidature spontanée, que
le cible prévoit par un attribut `est_spontanee` tout en la rendant impossible.

**L'état « contact principal » appartient au mandat, pas à la personne.**
Mesuré : sur 134 personnes présentes sur plusieurs mandats, **41 sont contact
principal sur certains et pas sur d'autres**, 10 changent de type d'équipe. La
Décision 6 remonte ces colonnes sur `core.contact_client` : elle écraserait 41
distinctions réelles.

**Deux tables répondent à « ce talent est-il sur ce mandat ? ».** `candidat_mandat`
porte 2 603 couples, `process` 7 088 : **4 492 dans process seulement, 7 dans
candidat_mandat seulement**. Ce ne sont pas des doublons mais deux notions
distinctes que personne n'a définies. Le cible garde les deux sans dire ce qui
les sépare — **clarification métier attendue**.

**Vingt-quatre combinaisons de drapeaux gouvernent l'exposition d'une offre.**
`job_anonyme`, `job_off_market`, `statut` et `visibilite` produisent 24
combinaisons réelles sur 534 mandats, dont **4 mandats à la fois `public` et
hors marché** et 15 `public` mais clos. Aucune règle ne dit lequel l'emporte —
et c'est le filtre du jalon 1.

**Le travail de recruteur sur 793 candidats n'a pas de domicile.** La règle
« une fiche = un candidat en process ou avec un compte » exclut 796 candidats du
miroir. Mesuré : **793 d'entre eux portent un travail de recruteur** — statut,
univers, niveau d'anglais, drapeau qualifié. Or la qualification ne peut pas
venir de Jarvi, c'est un acte du cabinet. La règle doit s'élargir.

**Le partage des 67 attributs de `core.talent` n'est pas fait.** L'étude a routé
71 colonnes du miroir vers `core.talent`, déclaré ensuite en **lecture seule** —
mais plusieurs sont des actes du cabinet (statut de qualification sur 3 347
candidats, emoji de statut sur 265, agent référent, drapeau actif) que le pivot
ne porte pas et ne peut donc pas rafraîchir. Il faut décider attribut par
attribut ce qui va à la projection et ce qui va à la fiche.
`correspondance.json` ne connaît pas encore la fiche — zéro occurrence — parce
qu'il a été produit avant cette décision.

## Notés, renvoyés au moteur d'inclusion

**La fusion de talents casse « une seule fiche par talent ».** Mesuré : **374
talents du pivot sont nés de la fusion de 769 candidats de l'app**, l'un en
ayant absorbé quatre. La contrainte d'unicité échouerait dès le premier jour, et
le moteur continuera de fusionner.

**La préséance actuelle contredit « la parole de la personne prime ».**
`app_pivot.py:28` : « Jarvi gagne l'identité (prénom, nom, localisation,
employeur). » Un candidat corrigeant son propre nom serait écrasé par un scrape.

## Statuts de mandat — la logique métier, précisée en séance

Le cible reprend les 4 statuts du miroir. Deux notions manquent, et Claude Menye
en a donné la définition :

- **En pause** — un mandat suspendu dont le process s'est arrêté. Il **n'est pas
  clos** : le confondre avec « Terminé » fausse le tableau de bord client et le
  délai de recrutement.
- **Reprise** — ce n'est **pas un statut** mais un lien : un mandat **issu d'un
  autre mandat**. Cela demande une relation entre deux mandats, pas une valeur
  d'énumération.

## Écarté après vérification

**« 32 personnes ont plusieurs comptes »** — j'en mesure **2**. La revue comptait
vraisemblablement les 105 entreprises à plusieurs comptes, qui sont le
multi-utilisateur normal et attendu.

**« 5 741 doublons d'identifiants entre `note` et `note_archivee` »** — les deux
tables ne partagent **aucun identifiant** (25 759 et 25 318, intersection nulle).
La duplication de *contenu* est réelle et documentée ailleurs dans le dépôt,
mais le mécanisme décrit est faux.

## Descendus après analyse

**L'effacement RGPD sur une projection en lecture seule** n'est pas un défaut
mais une conséquence normale : l'effacement se fait au pivot, la projection
suit. Reste à désigner qui l'orchestre.

**Le NPS rattaché à un mandat et à un placement depuis une colonne** est réel,
sur 118 lignes.

**Les entités `app` désignant le métier par des identifiants du miroir** sont la
conséquence assumée de la Décision 1, déjà documentée avec sa vue de
réconciliation. Pas un problème nouveau.

## Une suppression du miroir n'a pas de canal

Une ligne effacée dans Bubble entrerait dans `core` et n'en sortirait jamais.
Écarté en séance : le nettoyage se fera après, côté Supabase.

## Ce qui reste ouvert

**Bloquant pour la fiche** — ce qu'elle porte que le pivot n'a pas.

**Bloquant pour la préséance** — l'extension de la provenance par champ dans le
pivot, `attentes` en tête. Elle plafonne aussi la finesse de l'origine
« pré-rempli » côté fiche.

**À décider avant d'exposer l'historique** — le journal est-il visible du
candidat ? Et son périmètre d'effacement et d'anonymisation est-il bien pris en
compte, sachant qu'il porte des données personnelles ?

**Remontés par l'étude, à trancher avant d'écrire du SQL :**

- ~~`job_reve.salaire` et `salaire_maximum`~~ — **TRANCHÉ le 26/08 par la
  mesure** : `salaire` est le minimum. Sur 3 588 fiches, 85,1 % ont
  `salaire < salaire_maximum`, 14,5 % une égalité, 15 lignes inversées.
- ~~`candidat_expanded` ou `candidat`~~ — **TRANCHÉ le 26/08 par la mesure** :
  l'expanded est vivant, sur les six champs dupliqués sans exception (statut
  94,4 % contre 47,6 %, portfolio 10,4 % contre 0 %). L'expanded gagne,
  `candidat` comble les trous.
- Les 45 colonnes `sort_order` : classées artefact, mais elles portent l'ordre
  des listes déroulantes. Arbitrage de produit.
- `mandatclose` et `mandate_closed_split`, 54 colonnes de placement et de
  commission : une entité de revenu autonome ?
- `ref_slack_channel.webhook` et `ref_sendgrid_template` : des secrets dans des
  tables de données.

**À nettoyer avant de poser les contraintes** — 89 tags sur 110 rattachés à
rien, 20 analyses sans mandat, 16 lignes de NPS pointant un contact inexistant,
2 notes à l'auteur orphelin, 2 candidatures partageant un placement.

## Références

- `docs/MODELE_DONNEES.md` — l'état du modèle actuel, mesuré
- `docs/SCHEMA_CIBLE.md` — les 97 entités et la preuve de non-perte
- `docs/CONVENTIONS_MODELE.md` — les règles du schéma cible
- `backend/database/modele_cible/` — la correspondance des 688 colonnes
- Page consultable, deux figures : la chaîne du recrutement et le repli des
  cinq tables — https://claude.ai/code/artifact/bb6d713e-9e3c-459b-a209-717d252061b8
