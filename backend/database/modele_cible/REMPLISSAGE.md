# Taux de remplissage des 688 colonnes du miroir

> Mesuré en production le 26/08/2026, colonne par colonne, par comptage des
> valeurs non nulles. Données brutes : `remplissage.json`.

Ce relevé sert un seul but : **rendre factuel l'abandon d'une colonne**. Dans la
correspondance vers le schéma cible, une colonne ne peut être abandonnée que si
elle est un artefact de la plateforme Bubble, ou si elle est vide — et la
seconde raison se mesure au lieu de s'invoquer.

## 44 colonnes vides sur une table peuplée

Aucune donnée à perdre. Réparties sur 21 tables.

| table | colonnes vides |
|---|---|
| `mandat` | `description`, `video_youtube`, `z_legacy_number`, `source_marketing`, `lead_apporteur`, `business_maker_id`, `slug` |
| `process` | `description`, `moins_par_rapport_mission`, `date_statut_applicant`, `date_statut_ko`, `slug` |
| `candidat` | `opento`, `ajout_par_id`, `portfolio`, `slug` |
| `entreprise` | `apport_affaires_pct`, `type_entreprise`, `slug` |
| `task_notif` | `preview_text`, `task_type`, `slug` |
| `experience` | `entreprise_id`, `slug` |
| `note` | `note_user_tag_id`, `slug` |
| `note_archivee` | `mandatclose_id`, `slug` |
| `produit` | `description`, `slug` |
| `tag` | `description`, `slug` |
| `user` | `auth_id`, `slug` |
| `_sync_ecart` | `resolu_le` |
| `analyse` | `slug` |
| `candidat_expanded` | `slug` |
| `equipe` | `slug` |
| `job_actuel` | `slug` |
| `job_reve` | `slug` |
| `mandatclose` | `slug` |
| `mandate_closed_split` | `slug` |
| `nps_tracking` | `responded_at` |
| `task` | `slug` |

**Les 21 colonnes `slug` sont toutes vides** — l'artefact Bubble est ici
confirmé par la mesure, non supposé.

**`user.auth_id` est vide sur les 4 605 lignes** : le miroir ne peut pas porter
le rattachement des comptes, ce qui justifie une table de comptes propre à
l'application.

## 8 colonnes sous 1 % de remplissage

| colonne | remplissage |
|---|---|
| `equipe.description` | 0.1 % |
| `job_actuel.entreprise_id` | 0.1 % |
| `user.fonction` | 0.1 % |
| `candidat.business_maker_id` | 0.2 % |
| `note.note_event_value_new` | 0.3 % |
| `note.note_event_value_prev` | 0.3 % |
| `entreprise.success_fee_abs` | 0.6 % |
| `mandatclose.business_maker_coo_id` | 0.9 % |

Chacune demande un arbitrage : porter et réalimenter, ou abandonner. Un
remplissage de 0,1 % n'est pas rien — c'est peut-être une fonctionnalité
abandonnée, ou une qui n'a jamais démarré.

## Une correction que cette mesure a apportée

Une analyse affirmait que « les 6 274 motifs de KO vivent en texte libre dans
`process.moins_par_rapport_mission` ». La colonne est **vide à 100 %**.

Le fait réel est plus utile : **6 287 candidatures sur 7 243 — 87 % — se
terminent par un KO, et aucune colonne n'en donne le motif.** L'étape dit qui a
dit non, jamais pourquoi. Le motif de KO est donc une donnée à **créer**, pas à
migrer — et « ne rien perdre » ne se confond pas avec « tout reproduire ».

## Périmètre de la mesure

688 colonnes mesurées sur 107 tables. 211 colonnes appartiennent à des
tables de 100 lignes ou moins : leur taux de remplissage n'est pas un indice
fiable d'abandon, et elles ne figurent pas dans les listes ci-dessus.

