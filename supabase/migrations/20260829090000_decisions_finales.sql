-- =====================================================================
-- LES DERNIERS ARBITRAGES, TRANCHÉS — 29/08/2026
--
-- Six questions restaient ouvertes. Chacune est tranchée ci-dessous, avec
-- la mesure qui la fonde. Une seule ne repose pas sur une mesure, et elle
-- est signalée comme telle.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. core.vivier_mandat NE SERA PAS CRÉÉE
--
-- MESURE : public.candidat_mandat porte DEUX colonnes, candidat_id et
-- mandat_id. Ni attribut, ni horodatage, ni identifiant propre. Sur ses
-- 2 603 couples, 2 596 (99,7 %) existent déjà dans process.
--
-- Une table sans attribut dont le contenu est à 99,7 % dupliqué n'est pas
-- une entité : c'est un index de raccourci hérité d'un mécanisme de
-- shortlist que process a remplacé. La créer figerait une ambiguïté que
-- personne ne sait définir, et le modèle porterait une 36e table pour
-- 7 lignes de contenu propre.
--
-- REPRISE DES 7 COUPLES ORPHELINS : ils deviennent des candidatures sans
-- étape, marquées dans leur compte rendu. Le fait « ce talent a été
-- rapproché de ce mandat » est conservé, dans l'entité qui le porte.
-- ---------------------------------------------------------------------

comment on table core.candidature is
  'La rencontre entre un talent et un mandat — l''entité, pas le trait. 7 243 lignes, 1,74 candidature par talent jusqu''à 26, 15,3 par mandat jusqu''à 240. Reçoit aussi les 7 couples que public.candidat_mandat était seul à porter, sous forme de candidatures sans étape : cette table du miroir n''est pas reprise, étant une jonction nue dont 99,7 % du contenu duplique process. ⚠ RGPD : compte_rendu, les deux appréciations, les points forts et faibles et l''argumentaire client portent des jugements sur des personnes.';

-- ---------------------------------------------------------------------
-- 2. « JOB EXCLU » N'EST PAS UN TAG
--
-- MESURE sur les 18 mandats concernés : TOUS sont en visibilité privée,
-- TOUS sont terminés (11) ou closés (7), et le recouvrement avec les
-- drapeaux existants est nul — job_off_market 0/18, job_anonyme 0/18,
-- exclu_pachamama 1/18 (drapeau lui-même posé sur 401 des 535 mandats,
-- donc sans pouvoir discriminant).
--
-- C'est le seul des 16 « tags » sans emoji, et le seul qui ne décrive pas
-- un attrait du poste : les 15 autres disent « 🐓 Boîte FR », « 🌱
-- Croissance saine ». Le laisser dans ref.tag_job polluerait un
-- vocabulaire par ailleurs cohérent, et ferait passer une annotation de
-- gestion pour un argument de recrutement.
--
-- Il devient un drapeau du mandat. Sa SÉMANTIQUE reste inconnue — exclu
-- de quoi ? du reporting, de la facturation, du décompte ? — et la
-- colonne le dit, plutôt que de faire semblant.
-- ---------------------------------------------------------------------

alter table core.mandat add column est_exclu boolean not null default false;
comment on column core.mandat.est_exclu is
  '⚠ SÉMANTIQUE INCONNUE, donnée conservée. Repris du « tag » Job exclu du miroir, porté par 18 mandats — tous privés, tous terminés ou closés, sans recouvrement avec job_off_market ni job_anonyme. Ce n''est pas un attrait du poste mais une annotation de gestion : exclu de quoi, personne ne l''a documenté. À qualifier avec le métier ; en attendant la donnée survit plutôt que d''être jetée.';

delete from ref.tag_job where code = 'job_exclu';
update ref.correspondance
   set code_cible = 'est_exclu', origine = 'hors_referentiel'
 where referentiel = 'mandat_tag_job' and libelle_miroir = 'Job exclu';

-- ---------------------------------------------------------------------
-- 3. L'UNITÉ ENTRE DANS LE NOM DES COLONNES MONÉTAIRES
--
-- La vérification des unités a montré que la question se reposait à
-- chaque colonne, et qu'une seule erreur y fausserait tout le reporting.
-- La réponse durable n'est pas un commentaire : c'est le nom. Une colonne
-- nommée commission_ke ne peut pas être remplie en euros par distraction.
--
-- MESURÉ : commission, commission_nette et l'apport sont en K€ (ratio
-- commission/salaire de médiane 0,200, et apport = commission − nette à
-- l'euro près). Les TJM sont en €/jour.
-- ---------------------------------------------------------------------

alter table core.placement rename column commission                     to commission_ke;
alter table core.placement rename column commission_nette               to commission_nette_ke;
alter table core.placement rename column montant_apport_affaires        to montant_apport_affaires_ke;
alter table core.placement rename column montant_remboursement_garantie to montant_remboursement_garantie_ke;
alter table core.placement rename column tjm_facture_client             to tjm_facture_client_eur;
alter table core.placement rename column tjm_verse_talent               to tjm_verse_talent_eur;
alter table core.placement rename column montant_cooptation_talent      to montant_cooptation_talent_eur;

alter table core.mandat            rename column tjm_min to tjm_min_eur;
alter table core.mandat            rename column tjm_max to tjm_max_eur;
alter table core.candidature       rename column tjm_min to tjm_min_eur;
alter table core.candidature       rename column tjm_souhaite to tjm_souhaite_eur;
alter table core.fiche_talent      rename column attentes_tjm_min to attentes_tjm_min_eur;
alter table core.fiche_talent      rename column attentes_tjm_max to attentes_tjm_max_eur;
alter table core.talent            rename column attentes_tjm_min to attentes_tjm_min_eur;
alter table core.talent            rename column attentes_tjm_souhaite to attentes_tjm_souhaite_eur;

comment on column core.placement.montant_cooptation_talent_eur is
  '€, et non K€ comme ses voisines — SEULE COLONNE MONÉTAIRE DU MODÈLE DANS CE CAS, d''où le suffixe explicite. 21 valeurs dont 18 à zéro ; les 3 restantes sont 1, 250 et 350. En K€ une cooptation de 350 000 € serait absurde ; en € le « 1 » reste une saisie douteuse, à examiner. Le choix de l''euro préserve les deux valeurs plausibles et n''en abîme qu''une.';

-- ---------------------------------------------------------------------
-- 4. SUPERADMIN DEVIENT UNE QUATRIÈME VALEUR D'ÉNUMÉRÉ
--
-- L'alternative était un booléen sur l'accès. Elle est écartée : elle
-- créerait DEUX endroits où s'exprime le pouvoir interne, alors que toute
-- la Décision 4 tient à ce qu'il n'y en ait qu'un. Un énuméré reste
-- univoque, et son ordre de déclaration encode la hiérarchie.
-- Déclaré AVANT admin, pour que le tri place le plus puissant en tête.
-- ---------------------------------------------------------------------

alter type app.role_interne add value if not exists 'superadmin' before 'admin';

-- ---------------------------------------------------------------------
-- 5. core.apporteur_affaires RESTE EN VERSION TOLÉRANTE — définitif
--
-- La version stricte impose de créer 5 talents au pivot AVANT toute
-- reprise : elle ajoute une dépendance inter-systèmes sur le chemin
-- critique, pour 5 lignes. La tolérante coûte deux colonnes nullables.
-- Les 5 pourront être promus en talents plus tard, sans migration : il
-- suffira de renseigner talent_id et de vider nom_affichage.
-- ---------------------------------------------------------------------

comment on column core.apporteur_affaires.nom_affichage is
  'Renseigné UNIQUEMENT quand talent_id est nul — les 5 apporteurs qui ne sont pas des talents. Version tolérante retenue définitivement le 29/08/2026 : la stricte imposait de créer ces 5 personnes au pivot avant toute reprise, soit une dépendance inter-systèmes sur le chemin critique pour 5 lignes. Promotion possible plus tard sans migration.';

-- ---------------------------------------------------------------------
-- 6. L'ORDRE DU PIPELINE — LA SEULE DÉCISION NON MESURÉE DU MODÈLE
--
-- Le sort_order d'origine est parti avec public.ref_process_etape.
-- Trois pistes ont été cherchées et aucune n'aboutit : les volumes par
-- étape ne s'ordonnent pas (les KO ponctionnent à chaque palier), les
-- deux colonnes de dates de statut sont vides à 100 %, et les 24
-- événements de ref_note_event ne mentionnent aucune étape.
--
-- L'ordre retenu est donc l'entonnoir de recrutement usuel. C'est une
-- inférence de métier, assumée comme telle, et le seul endroit du modèle
-- où je n'ai pas pu mesurer.
-- ---------------------------------------------------------------------

comment on column ref.etape_process.ordre is
  '⚠ INFÉRÉ, non mesuré — le seul attribut du modèle dans ce cas. Le sort_order d''origine est parti avec public.ref_process_etape, détruit. Trois pistes cherchées, aucune n''aboutit : les volumes ne s''ordonnent pas, les dates de statut sont vides à 100 %, les événements de note ne mentionnent aucune étape. Ordre retenu : l''entonnoir usuel, de to_contact à hired, puis les quatre KO. À confirmer avant d''ouvrir le kanban.';

-- ---------------------------------------------------------------------
-- 7. LE PIÈGE D'UNITÉ ÉTAIT RÉEL, ET IL EST ENTRE DEUX TABLES
--
-- MESURÉ le 29/08/2026 : le ratio mandate_closed_split.total sur
-- mandatclose.commission a pour médiane 1000,000 exactement, sur 144
-- couples. Les montants de la RÉPARTITION sont donc en EUROS, tandis que
-- la commission du PLACEMENT est en K€. Un facteur mille entre deux
-- tables qui décrivent la même somme d'argent.
--
-- C'est exactement l'erreur que le détail redoutait sans pouvoir la
-- nommer. Additionner une commission et ses parts, ou comparer l'une à
-- l'autre, donnait un résultat faux d'un facteur 1000 — et rien dans les
-- noms ne l'aurait signalé.
--
-- Les colonnes portent désormais leur unité. C'est la raison d'être de
-- cette convention : elle rend l'erreur inécrivable.
-- ---------------------------------------------------------------------

alter table core.repartition_commission rename column agent_1_montant              to agent_1_montant_eur;
alter table core.repartition_commission rename column agent_2_montant              to agent_2_montant_eur;
alter table core.repartition_commission rename column apporteur_cooptation_montant to apporteur_cooptation_montant_eur;
alter table core.repartition_commission rename column apporteur_deal_montant       to apporteur_deal_montant_eur;
alter table core.repartition_commission rename column pachamama_montant            to pachamama_montant_eur;
alter table core.repartition_commission rename column net_montant                  to net_montant_eur;
alter table core.repartition_commission rename column total_montant                to total_montant_eur;

comment on table core.repartition_commission is
  'La répartition de la commission d''un placement entre agents, apporteurs et le cabinet. 266 lignes, jusqu''à 5 par placement. ⚠ SES MONTANTS SONT EN EUROS, ceux de core.placement en K€ — mesuré, le ratio total/commission vaut exactement 1000 sur 144 couples. Le suffixe _eur contre _ke est la seule protection contre une addition fausse d''un facteur mille. Aucune contrainte d''égalité entre total et la somme des parts : la formule d''origine est inconnue et une contrainte fausse bloquerait les 266 lignes. Une vue de contrôle des écarts la remplace.';

comment on column core.repartition_commission.total_montant_eur is
  '€. ⚠ 3 valeurs aberrantes à examiner avant reprise : le maximum observé atteint 43 355 000 €, soit 43 M€ de commission, et le ratio au placement s''étale de 999,58 à 1 277,78 là où il devrait valoir 1000 tout rond.';

-- ---------------------------------------------------------------------
-- 8. success_fee_abs MÉLANGE DEUX UNITÉS DANS LA MÊME COLONNE
--
-- MESURÉ : 5 valeurs non nulles sur 851 entreprises, et quatre valeurs
-- distinctes — 10 · 11,5 · 10 000 · 18 000. Les deux premières sont des
-- K€, les deux dernières des euros. La même colonne porte donc les deux
-- conventions, saisies par des mains différentes.
--
-- RÈGLE DE NORMALISATION à appliquer à la reprise, en K€ :
--     valeur >= 1000  →  valeur / 1000     (c'était des euros)
--     valeur <  1000  →  inchangée         (c'était déjà des K€)
-- Le seuil est sûr ici : un honoraire forfaitaire de 1 000 K€ (un million
-- d'euros) est invraisemblable, un honoraire de 10 € aussi. Les quatre
-- valeurs deviennent 10 · 11,5 · 10 · 18.
--
-- La règle est écrite ici, pas laissée au script de reprise : elle est
-- vérifiable, et le jour où une cinquième valeur arrive on saura ce qui
-- lui a été appliqué.
-- ---------------------------------------------------------------------

alter table core.entreprise rename column success_fee_abs to success_fee_abs_ke;
comment on column core.entreprise.success_fee_abs_ke is
  'K€. ⚠ La source mélangeait deux unités : 10 et 11,5 en K€, 10 000 et 18 000 en euros, sur 5 valeurs non nulles seulement. Normalisation à la reprise : valeur >= 1000 divisée par 1000, sinon inchangée. Seuil sûr — un forfait de 1 000 K€ ou de 10 € est invraisemblable.';
