# Anonymisation — ce qui est protégé, et ce qui ne l'est pas

> Fichier **généré** par `verifier_classification.py --ecrire` à partir de
> `classification.json`. Ne pas le modifier à la main : il serait aussitôt
> écrasé, et surtout il cesserait de dire la vérité.

> **08/09/2026 — la pseudonymisation du projet de développement est levée.**
> Sur décision du dirigeant, le dev est une capture de données réelles à un
> instant t : il porte désormais des données personnelles réelles.
> `restaurer_reel.py` a réécrit dans le dev les valeurs lues en production.
> Ce document ne décrit plus l'état du dev, mais le **mode anonymisé de
> `peupler_dev.py`** — la protection qui s'appliquerait si le dev était
> repeuplé par lui.

## La règle

Ce qui identifie une personne est substitué. Ce qui décrit une offre, une entreprise ou un référentiel reste réel.

**Clé de substitution : la VALEUR réelle, pas l'identifiant de ligne — deux tables portant le même nom réel reçoivent le même substitut, sans jointure.**

Conséquence directe : `candidat.prenom`, `user.prenom` et
`nps_tracking.candidate_firstname` reçoivent le même substitut pour la même
personne, sans qu'aucune jointure soit nécessaire. C'est ce qui rend le jeu de
développement cohérent d'un écran à l'autre.

## Le compte

| traitement | colonnes | part |
|---|---:|---:|
| `CONSERVER` | 660 | 84.1 % |
| `SUBSTITUER` | 61 | 7.8 % |
| `VIDER` | 44 | 5.6 % |
| `GENERALISER` | 18 | 2.3 % |
| **total** | **785** | |

Soit **125 colonnes touchées** sur 785, réparties dans 118 tables.

## Le détail, table par table

Seules les colonnes touchées sont listées. Toutes les autres sont conservées
telles quelles — leur absence ici est donc une affirmation, pas un oubli.

### `pivot.attentes`

| colonne | traitement | pourquoi |
|---|---|---|
| `nogo` | SUBSTITUER | SUIT le script, qui l'argumente : `nogo` nomme les entreprises qu'un talent REFUSE — le plus souvent son employeur actuel ou passé, donc identifiant par recoupement, et accessoirement une information sensible sur sa relation de travail. Remplacé par deux sociétés fictives tirées de SOCIETES. Point de méthode à reprendre : le script vérifie cette colonne par ASSERTION (valeur écrite ≠ valeur réelle) et non par scan textuel, parce qu'un nom de secteur légitime ailleurs dans le dump produirait un faux positif. |
| `disponibilite` | GENERALISER | SUIT le script — et c'est le SEUL vrai GENERALISER de l'anonymiseur existant. Le champ est du texte libre rédigé par les recruteurs et contient des noms d'entreprises (« à voir avec X ») : il est réduit à trois catégories, Immédiate / À terme / Non précisée. On garde l'axe analytique (quand la personne est disponible) sans transporter le texte. Vérifié par assertion, avec l'exception correcte : une valeur réelle qui vaut déjà exactement une des trois catégories n'est pas une fuite. |
| `description` | SUBSTITUER | SUIT le script : jeton constant '[description anonymisée]'. Texte libre rédigé par le talent sur son projet. Le choix du jeton plutôt que du NULL est délibéré et je le garde : il préserve le signal « a rempli sa description », qui est une mesure d'engagement exploitable en dev. |

### `pivot.conflit`

| colonne | traitement | pourquoi |
|---|---|---|
| `valeur_retenue` | SUBSTITUER | NON COUVERTE — et c'est le trou le plus grave du dispositif actuel. La migration 03 le déclare noir sur blanc : « Ce journal porte des DONNÉES PERSONNELLES : les valeurs retenues et écartées sont des noms, des employeurs, des localisations. » Un jeu de données anonymisé côté talent mais brut ici rend l'anonymisation entièrement caduque : le journal redonne le vrai nom en clair, à côté du talent_id qui le rattache à la ligne dorée. RÈGLE DE SUBSTITUTION : appliquer le traitement de la colonne DÉSIGNÉE PAR `champ`, avec LE MÊME substitut déterministe que celui écrit dans pivot.talent (pick(PRENOMS, talent_id, 1) pour champ='prenom', pick(SOCIETES, talent_id, 4) pour champ='employeur_actuel', etc.) — sinon le journal contredit l'enregistrement doré et devient illisible. Cas particulier cohérent : pour champ='localisation', conservée dans talent, la valeur est conservée ici aussi. |
| `valeur_ecartee` | SUBSTITUER | NON COUVERTE. Même nature personnelle que valeur_retenue, et déclarée telle par la migration. Différence de traitement : la valeur PERDANTE n'a aucun pendant dans pivot.talent, il n'y a donc pas de substitut à répliquer — tirer un second substitut de la même liste avec un sélecteur distinct, en garantissant qu'il diffère de valeur_retenue. Sans cette garantie, la ligne cesse de décrire un conflit et le journal devient inexploitable pour tester le moteur d'arbitrage. |

### `pivot.email`

| colonne | traitement | pourquoi |
|---|---|---|
| `email` | SUBSTITUER | SUIT le script sur le principe : adresse dérivée des substituts (prenom.nom@exemple.test), normalisée sans accents, avec rang pour respecter la contrainte d'unicité — le script documente ce point précisément. ÉCART sur le GÉNÉRATEUR : il produit une adresse nominale même lorsque generique=true, ce qui contredit le drapeau et rend qa_emails_generiques incohérente (elle listerait des adresses en prénom.nom comme adresses de service). En dev, générer contact+N@exemple.test pour les lignes generique=true. |

### `pivot.note_journal`

| colonne | traitement | pourquoi |
|---|---|---|
| `contenu` | SUBSTITUER | SUIT le script : jeton constant, appliqué INCONDITIONNELLEMENT, y compris aux notes automatiques. C'est le bon choix et je le garde : une note générée par un automatisme cite quand même des noms, des entreprises et des montants. C'est le corpus le plus dense en données personnelles de tout le schéma (~19 400 lignes en production). |
| `external_id` | SUBSTITUER | SUIT le script : `note-${h(external_id ?? id)}`. Clé du système source, même raisonnement que talent_source.external_id, et c'est elle qui porte l'idempotence du chargement. RÉSERVE : la contrainte d'unicité est composite, donc seule une collision de h() à l'intérieur d'un même talent casserait l'INSERT — surveiller si l'échantillon de dev grossit vers le volume réel. |

### `pivot.parcours`

| colonne | traitement | pourquoi |
|---|---|---|
| `experience` | SUBSTITUER | SUIT le script : jeton constant '[parcours anonymisé — structure conservée]'. Export Jarvi APLATI de l'expérience — employeurs successifs, intitulés, dates : réidentifiant en une seule lecture, même sans le nom. |
| `formation` | SUBSTITUER | SUIT le script : jeton constant '[formation anonymisée]'. École + promotion réidentifie dans une population restreinte. |
| `competences` | GENERALISER | ÉCART. Le script CONSERVE, au motif qu'« une liste de compétences n'est pas identifiante ». Le motif tient pour une liste NORMALISÉE — mais la colonne est du TEXTE LIBRE issu du même export aplati que experience et formation, et rien dans le schéma ne garantit qu'elle ne contient que des compétences. S'ajoute le fait qu'une combinaison rare de compétences est un quasi-identifiant reconnu. En dev : ne retenir que les jetons reconnus dans un vocabulaire de compétences (celui de qualification.expertises fait l'affaire) et jeter le reste — on préserve l'axe de recherche sans faire confiance au contenu. À noter que le script scanne bien experience dans son contrôle 4c, mais jamais competences : ni substituée, ni vérifiée. |

### `pivot.phone`

| colonne | traitement | pourquoi |
|---|---|---|
| `tel` | SUBSTITUER | SUIT le script : numéro à 9 chiffres fabriqué à partir de h(talent_id), jamais attribuable à un abonné réel. Un numéro est un identifiant direct et à forte entropie — le script le scanne en dur dans son contrôle 4b, à raison : une correspondance textuelle y est nécessairement une fuite, jamais une coïncidence. |

### `pivot.sync_etat`

| colonne | traitement | pourquoi |
|---|---|---|
| `curseur` | VIDER | NON COUVERTE — et c'est la colonne la plus dangereuse à recopier de tout le schéma, alors qu'elle ne contient aucune donnée personnelle. Un curseur de production importé fait croire au connecteur de dev qu'il est déjà à jour : l'incrémental ne lit plus rien, SILENCIEUSEMENT, et tout ce qui précède cette date devient structurellement inatteignable. C'est exactement le mode de défaillance documenté par la migration (règle 1 : un curseur avancé à tort a coûté 396 enregistrements au miroir). NULL, associé à statut='jamais_lance', donne un environnement vierge qui repart d'un rattrapage complet. |
| `statut` | REINITIALISER | remise à zéro : le dev ne doit pas hériter de l'avancement de la production |
| `demarre_le` | VIDER | NON COUVERTE. NULL, par cohérence avec 'jamais_lance'. Dater le démarrage d'un run qui n'a pas eu lieu dans cet environnement est un mensonge que la supervision lira comme un fait. |
| `termine_le` | VIDER | NON COUVERTE. NULL, même raisonnement : l'écart demarre_le/termine_le est le seul moyen de distinguer « rien à faire » de « mort en chemin », il ne doit pas être hérité de production. |
| `message_erreur` | VIDER | NON COUVERTE. Texte libre renvoyé par un système tiers : un message d'erreur d'API recopie couramment le corps de l'enregistrement fautif, donc potentiellement un email, un nom, un téléphone. C'est un canal de fuite INDIRECT, qu'aucun scan orienté colonnes personnelles n'attraperait — et il n'a de toute façon aucun sens en dev. |
| `volume_dernier_run` | VIDER | NON COUVERTE. NULL : aucun run n'a eu lieu dans l'environnement de développement, un volume hérité fausserait immédiatement la lecture de la première exécution. |
| `runs_total` | REINITIALISER | remise à zéro : aucun run n'a eu lieu contre le dev |

### `pivot.sync_run`

| colonne | traitement | pourquoi |
|---|---|---|
| `run_id` | SUBSTITUER | NON COUVERTE par generer_dump.mjs (ajoutée en migration 03). REMARQUE PRÉALABLE valable pour toute la table : c'est un journal des exécutions de PRODUCTION ; par défaut, le plus sain est de NE RIEN CHARGER et de laisser les runs de dev la remplir. Les traitements ci-dessous valent si l'on veut malgré tout un jeu de démonstration pour les écrans de supervision. Pour run_id : la clé est fabriquée par le connecteur et peut embarquer un nom d'hôte, un identifiant de job ou un horodatage de production — de l'infrastructure, pas de la donnée personnelle, mais rien qui ait à sortir. Régénérer en 'dev-0001'… |
| `statut` | SUBSTITUER | NON COUVERTE. Conserver la valeur SAUF 'en_cours', à réécrire en 'erreur'. Un run en vol importé décrit une exécution qui ne se terminera jamais — or « un statut en_cours qui traîne » est précisément le marqueur que la migration désigne pour repérer un run interrompu : hériter d'un faux positif rend ce signal inutilisable dès le premier jour. |
| `curseur_avant` | VIDER | NON COUVERTE. Watermark de production stocké dans une ligne de journal : inerte tant que personne ne le lit, mais tout chemin de REPRISE consiste justement à re-primer sync_etat.curseur depuis le dernier run connu. Un curseur accessible depuis le journal est un curseur qu'une reprise peut réinjecter — et on retombe alors sur la panne silencieuse décrite pour sync_etat.curseur. Variante acceptable si l'on tient à tester la supervision de progression : SUBSTITUER par des dates relatives à l'environnement de dev, plutôt que conserver les vraies. |
| `curseur_apres` | VIDER | NON COUVERTE. Même raisonnement que curseur_avant, en plus exposé : c'est cette valeur-là qu'une reprise irait chercher en priorité. |
| `message` | VIDER | NON COUVERTE. Texte libre écrit par le connecteur en fin de run : mêmes risques que sync_etat.message_erreur — il recopie volontiers un fragment de payload source, donc potentiellement une donnée personnelle, dans une colonne que personne ne classe comme personnelle. |

### `pivot.talent`

| colonne | traitement | pourquoi |
|---|---|---|
| `prenom` | SUBSTITUER | SUIT le script : tirage déterministe dans PRENOMS par hachage de talent_id, avec NULL préservé si NULL (test explicite `t.prenom === null`). Ce détail compte : il conserve la statistique de complétude et laisse qa_sans_identite peuplée. |
| `nom` | SUBSTITUER | SUIT le script : tirage déterministe dans NOMS, sélecteur distinct de celui du prénom, NULL préservé. Le script purge en amont les listes de substituts qui collisionneraient avec une valeur réelle de l'échantillon — garde-fou à reprendre tel quel en dev. |
| `headline` | SUBSTITUER | SUIT le script : tirage dans POSTES. Un headline est du texte libre rédigé par la personne, très souvent auto-identifiant (« CTO @ <société> », accroche personnelle). Conséquence assumée : la distribution réelle des intitulés est détruite (8 valeurs possibles) — acceptable, ce n'est pas un axe de mesure du projet. |
| `url_linkedin` | SUBSTITUER | SUIT le script : URL reconstruite à partir des prénom/nom substitués + suffixe numérique dérivé de talent_id. C'est l'identifiant direct le plus fort du schéma — un slug LinkedIn EST une personne — et le script le traite comme tel en le scannant en dur dans son contrôle 4b (identifiants à forte entropie). |
| `employeur_actuel` | SUBSTITUER | SUIT le script : tirage dans SOCIETES. Employeur + ville + intitulé est le triplet de réidentification classique ; c'est aussi la colonne que qa_multi_source publie à côté du nom et des identifiants externes. |
| `cv_url` | SUBSTITUER | SUIT le script : URL constante 'https://exemple.test/cv/anonymise.pdf'. L'URL réelle pointe un CV — donc une pièce nominative complète, et souvent un lien signé encore valide au moment où le dump circule. La présence/absence est conservée, ce qui préserve les deux indicateurs qui en dérivent. |
| `notes_jarvi` | SUBSTITUER | SUIT le script : jeton constant '[note anonymisée pour le livrable]'. Texte libre rédigé par des recruteurs AU SUJET de la personne — appréciation, la catégorie la plus lourde côté RGPD. |
| `notes_bloc` | VIDER | SUIT le script (`notes_bloc: null`). Consolidation LLM du journal de notes : donnée dérivée et régénérable depuis note_journal, donc rien à préserver ; et un résumé libre est le pire porteur de détails identifiants résiduels. VIDER plutôt que SUBSTITUER, parce qu'aucun indicateur ne mesure sa présence. |

### `pivot.talent_source`

| colonne | traitement | pourquoi |
|---|---|---|
| `external_id` | SUBSTITUER | SUIT le script : `${source}-${h(external_id)}`. C'est une clé primaire de système tiers, donc le chemin de réidentification le plus direct : on la rejoue dans Jarvi et on retrouve la personne. qa_multi_source la publie en clair, concaténée. RÉSERVE : h() est un hachage tronqué à 32 bits — les collisions sont improbables mais possibles ; la PK étant composite, seule une collision à l'intérieur d'un même couple (talent, source) casserait le chargement. Conséquence assumée et souhaitable : l'environnement de dev ne peut plus se rapprocher des vrais systèmes source. |

### `public._sync_ecart`

| colonne | traitement | pourquoi |
|---|---|---|
| `detail` | VIDER | Diagnostic libre : peut recopier un extrait de fiche réelle (nom, email) dans le message. |

### `public._sync_passe`

| colonne | traitement | pourquoi |
|---|---|---|
| `incidents` | VIDER | Log libre : peut contenir des extraits de fiches réelles. |

### `public._sync_quarantine`

| colonne | traitement | pourquoi |
|---|---|---|
| `motif` | VIDER | Motif libre : peut recopier le contenu de la fiche sautée. |

### `public._sync_state`

| colonne | traitement | pourquoi |
|---|---|---|
| `error_message` | VIDER | Message d'erreur libre : peut contenir une charge utile de fiche réelle. |

### `public.analyse`

| colonne | traitement | pourquoi |
|---|---|---|
| `description` | VIDER | Appréciation libre d'un agent sur un mandat ; cite nommément des personnes de l'équipe cliente. |

### `public.business_maker`

| colonne | traitement | pourquoi |
|---|---|---|
| `prenom` | SUBSTITUER | Prénom d'une personne physique (apporteur d'affaires). |
| `nom` | SUBSTITUER | Nom d'une personne physique. |
| `email` | SUBSTITUER | Adresse nominative. |
| `company_label` | SUBSTITUER | Raison sociale de l'apporteur : très souvent « Prénom Nom EI/Consulting », donc identifiante. |
| `picture_url` | SUBSTITUER | Photo de visage = identification directe. |
| `siret` | SUBSTITUER | Sur une entreprise individuelle, le SIRET remonte à la personne via l'annuaire INSEE. |
| `slug` | SUBSTITUER | Dérivé du nom de la personne. |

### `public.candidat`

| colonne | traitement | pourquoi |
|---|---|---|
| `nom` | SUBSTITUER | Identité directe. |
| `prenom` | SUBSTITUER | Identité directe. |
| `prenom_lower` | SUBSTITUER | Copie minuscule du prénom, sert la recherche. |
| `nom_lower` | SUBSTITUER | Copie minuscule du nom. |
| `email_perso` | SUBSTITUER | Coordonnée personnelle. |
| `linkedin` | SUBSTITUER | Une URL LinkedIn réelle réidentifie à 100 %. |
| `telephone` | SUBSTITUER | Coordonnée personnelle. |
| `photo_url` | SUBSTITUER | Visage = identification directe. |
| `cv_url` | SUBSTITUER | Le PDF pointé contient l'intégralité du dossier réel. |
| `portfolio_file_url` | SUBSTITUER | Même risque que le CV. |
| `genre` | SUBSTITUER | Donnée sensible attachée à une personne. |
| `salaire_max_souhait` | GENERALISER | Prétention salariale rattachée à une personne : quasi-identifiant quand on la croise avec métier et localisation. |
| `salaire_min_souhait` | GENERALISER | Idem. |
| `tjm_max_souhait` | GENERALISER | Idem, côté freelance. |
| `tjm_min_souhait` | GENERALISER | Idem. |
| `localisations` | GENERALISER | Peut porter adresse et coordonnées géographiques. |
| `localisations_filtre` | GENERALISER | C'est cette colonne — et non le JSON — que l'app lit réellement pour filtrer. |
| `grandes_ecoles` | GENERALISER | Si la colonne porte le nom de l'établissement, école + promo + métier + ville est un quasi-identifiant fort. |
| `pachamama_like` | VIDER | Appréciation libre rédigée sur la personne, aucune valeur pour le dev. |
| `pachamama_personnalite` | VIDER | Appréciation libre sur la personnalité : peut relever des données sensibles. |
| `note_interne` | VIDER | Note interne libre : cite des tiers, porte des opinions, parfois des éléments de santé ou de vie privée. |
| `portfolio` | SUBSTITUER | URL d'un site personnel, généralement au nom de la personne. |
| `slug` | SUBSTITUER | Dérivé du prénom et du nom, et exposé comme route. |

### `public.candidat_expanded`

| colonne | traitement | pourquoi |
|---|---|---|
| `ecole` | SUBSTITUER | Nom d'établissement : quasi-identifiant fort combiné au métier et à la tranche d'âge. |
| `perso` | VIDER | Texte libre sur la vie personnelle du candidat. |
| `portfolio` | SUBSTITUER | URL personnelle nominative. |
| `note_1` | VIDER | Note libre d'un agent sur la personne. |
| `note_2` | VIDER | Note libre d'un agent sur la personne. |
| `slug` | SUBSTITUER | Peut reprendre l'identité du candidat. |

### `public.entreprise`

| colonne | traitement | pourquoi |
|---|---|---|
| `fondateur` | SUBSTITUER | Nom d'une personne physique. |
| `siret` | SUBSTITUER | Donnée de facturation ; sur une entreprise individuelle le SIRET remonte à une personne physique via l'annuaire INSEE. |
| `note` | VIDER | Note interne libre sur le client : opinions, noms d'interlocuteurs. |
| `email_facturation` | SUBSTITUER | Adresse nominative de contact ; conservée, un run de dev pourrait écrire à une vraie personne. |
| `recommandation` | VIDER | Champ libre qui porte le plus souvent le nom de la personne ayant recommandé le client. |

### `public.equipe`

| colonne | traitement | pourquoi |
|---|---|---|
| `nom` | SUBSTITUER | 650 contacts client : ce sont des personnes physiques, rarement pensées comme telles. |
| `prenom` | SUBSTITUER | Identité directe. |
| `email` | SUBSTITUER | Adresse professionnelle nominative ; risque d'envoi réel depuis le dev. |
| `description` | VIDER | Texte libre sur la personne. |
| `photo_url` | SUBSTITUER | Visage = identification directe. |
| `slug` | SUBSTITUER | Dérivé du nom de la personne. |

### `public.job_actuel`

| colonne | traitement | pourquoi |
|---|---|---|
| `entreprise_nom` | SUBSTITUER | Employeur actuel saisi librement : croisé au métier et à la ville, c'est un quasi-identifiant du candidat, pas une donnée client. |
| `entreprise_id` | VIDER | Conservé, il annule par simple jointure la substitution de entreprise_nom : il redonne le vrai employeur du candidat. |
| `pourquoi` | VIDER | Texte libre : pourquoi la personne veut partir. Opinions sur son employeur et ses collègues. |

### `public.job_reve`

| colonne | traitement | pourquoi |
|---|---|---|
| `description` | VIDER | Texte libre du candidat : cite employeurs, collègues, situation personnelle. |
| `info_localisation` | VIDER | Localisation en texte libre : peut donner le quartier ou l'adresse. L'information exploitable est déjà dans localisations. |
| `infos_salaire` | VIDER | Texte libre de négociation salariale. |
| `salaire` | GENERALISER | Prétention rattachée à une personne. |
| `salaire_maximum` | GENERALISER | Idem. |
| `tjm_minimum` | GENERALISER | Idem, côté freelance. |
| `tjm_maximum` | GENERALISER | Idem. |
| `localisations` | GENERALISER | Peut porter adresse et coordonnées. |

### `public.note`

| colonne | traitement | pourquoi |
|---|---|---|
| `commentaire` | VIDER | 20 018 commentaires libres écrits par des agents sur des personnes : le gisement de risque le plus dense de la base, et sans valeur pour construire les écrans. |
| `note_event_value_new` | VIDER | Rejoue en clair la valeur APRÈS du champ modifié : un nom, un email ou un salaire réel que la substitution des tables n'atteint pas. Canal de fuite silencieux. |
| `note_event_value_prev` | VIDER | Idem pour la valeur AVANT. |

### `public.note_archivee`

| colonne | traitement | pourquoi |
|---|---|---|
| `commentaire` | VIDER | 19 778 commentaires libres sur des personnes. |

### `public.nps_tracking`

| colonne | traitement | pourquoi |
|---|---|---|
| `contact_email` | SUBSTITUER | Adresse nominative d'un contact client ; conservée, une relance NPS lancée depuis le dev partirait à une vraie personne. |
| `contact_firstname` | SUBSTITUER | Prénom d'une personne physique. |
| `candidate_firstname` | SUBSTITUER | Prénom du talent placé. |

### `public.process`

| colonne | traitement | pourquoi |
|---|---|---|
| `description` | VIDER | Compte rendu d'entretien libre sur une personne. |
| `pachamama_like` | VIDER | Appréciation libre sur la personne. |
| `pachamama_personnalite` | VIDER | Appréciation sur la personnalité : peut relever des données sensibles. |
| `plus_par_rapport_mission` | VIDER | Évaluation libre d'une personne identifiée. |
| `moins_par_rapport_mission` | VIDER | Évaluation libre — jugement négatif nominatif, risque le plus élevé de la table. |
| `infos_remuneration` | VIDER | Texte libre de négociation salariale. |
| `salaire_minimum` | GENERALISER | Prétention d'une personne engagée dans un process identifiable (entreprise réelle × date). |
| `salaire_souhaite` | GENERALISER | Idem. |
| `tjm_minimum` | GENERALISER | Idem, côté freelance. |
| `tjm_souhaite` | GENERALISER | Idem. |

### `public.ref_email_config`

| colonne | traitement | pourquoi |
|---|---|---|
| `email_adresses` | SUBSTITUER | EXCEPTION aux ref_* : contient des adresses de destination réelles de l'équipe. Conservée, une exécution de dev enverrait de vrais emails à de vraies personnes. |

### `public.ref_slack_channel`

| colonne | traitement | pourquoi |
|---|---|---|
| `webhook` | VIDER | EXCEPTION aux ref_* : URL de webhook Slack = secret d'exploitation ET canal d'effet de bord. Conservée, le dev poste dans le vrai Slack de l'équipe. |
| `webhook_test` | VIDER | Même nature de secret. |

### `public.task`

| colonne | traitement | pourquoi |
|---|---|---|
| `task_text` | VIDER | Libellé produit par interpolation d'un gabarit : contient en clair le nom du talent et du client. La substitution des tables ne l'atteint pas. |

### `public.task_notif`

| colonne | traitement | pourquoi |
|---|---|---|
| `preview_text` | VIDER | Aperçu du message : noms de talents et de clients en clair. |
| `sent_email` | SUBSTITUER | Adresse destinataire réelle ; conservée, un rejeu de workflow depuis le dev écrirait à une vraie personne. |
| `sent_text` | VIDER | Corps du message envoyé : noms en clair. |

### `public.user`

| colonne | traitement | pourquoi |
|---|---|---|
| `auth_id` | VIDER | Pointe vers auth.users du projet LIVE. Recopié dans le dev il ne correspond à personne, et l'unicité bloquerait la création d'un compte de test rattaché au même agent. |
| `nom` | SUBSTITUER | Identité d'un agent, d'un candidat ou d'un contact entreprise. |
| `prenom` | SUBSTITUER | Identité directe. |
| `photo_url` | SUBSTITUER | Visage = identification directe. |
| `slug` | SUBSTITUER | Dérivé du nom de la personne. |

## Ce que cette classification ne couvre pas

**Le référentiel des comptes.** `auth.users` n'appartient à aucun des deux
schémas et n'est pas chargé. Le projet de développement démarre donc sans aucun
compte — c'est le travail du jalon 2 d'en créer.

**Les fichiers.** Les URL de CV, de photo et de portfolio sont remplacées par
des adresses factices, mais les fichiers eux-mêmes vivent dans le Storage du
projet de production et ne sont pas copiés.

**Les quasi-identifiants conservés.** Séniorité, expertises, secteurs et
statut de process restent réels et rattachés à une même ligne. Sur un vivier de
30 829 personnes, un profil rare reste recoupable. Il s'agit donc d'une
**pseudonymisation**, pas d'une anonymisation au sens du RGPD, et il ne faut pas
écrire le contraire.

