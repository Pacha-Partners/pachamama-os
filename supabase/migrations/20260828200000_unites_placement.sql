-- =====================================================================
-- UNITÉS DES MONTANTS DU PLACEMENT — mesurées le 28/08/2026
--
-- Le détail signalait : « salaire_final est en K€ depuis l'harmonisation
-- du 01/07, mais commission, commission_nette et l'apport d'affaires
-- n'ont pas été vérifiés. Une erreur d'unité ici fausse tout le
-- reporting financier. » Vérification faite sur les 228 lignes de
-- public.mandatclose.
--
-- PREUVE 1 — le ratio commission / salaire_final a pour médiane 0,200
-- sur 144 couples, soit exactement les 20 % d'honoraires. Deux montants
-- dans la même unité. Un facteur 1000 donnerait 200.
--
-- PREUVE 2 — sur les 3 lignes où l'apport d'affaires est non nul :
--     commission − commission_nette = apport_affaires_k, À L'EURO PRÈS
--     19,44 − 17,50 = 1,94   16,33 − 14,70 = 1,63   17,48 − 15,73 = 1,75
-- C'est donc un MONTANT dans la même unité que la commission, et non un
-- pourcentage comme sa magnitude (1,6 à 1,9) pouvait le laisser croire.
-- Au passage, la règle métier apparaît : l'apport vaut 10 % de la
-- commission, et la commission nette est ce qui reste après.
--
-- Ce fichier ne change aucune structure : il inscrit dans la base ce que
-- la mesure a établi, pour que la question ne se repose pas.
-- =====================================================================

comment on column core.placement.salaire_final_ke is
  'K€. Harmonisé le 01/07/2026. Médiane 70, maximum 188 sur 147 valeurs.';
comment on column core.placement.commission is
  'K€ — MESURÉ : le ratio commission/salaire a pour médiane 0,200 sur 144 couples, soit les 20 % d''honoraires. Médiane 14, maximum 43.';
comment on column core.placement.commission_nette is
  'K€. Ce qui reste après déduction de l''apport d''affaires : commission − montant_apport_affaires, vérifié à l''euro près sur les 3 lignes concernées.';
comment on column core.placement.montant_apport_affaires is
  'K€ et NON un pourcentage, malgré une magnitude de 1,6 à 1,9. MESURÉ : vaut exactement commission − commission_nette sur les 3 lignes non nulles, soit 10 % de la commission.';
comment on column core.placement.tjm_facture_client is
  '€ PAR JOUR, et non des K€ — c''est un taux journalier. Source : mandatclose.tjm_final_marge_inclus, le taux facturé au client, marge comprise.';
comment on column core.placement.tjm_verse_talent is
  '€ PAR JOUR. Source : mandatclose.tjm_final_talent. Observé de 400 à 1 360, médiane 630, systématiquement inférieur au taux facturé au client.';
comment on column core.placement.montant_cooptation_talent is
  '⚠ UNITÉ NON TRANCHÉE, seule colonne monétaire du placement dans ce cas. 21 valeurs dont 18 à zéro ; les 3 restantes sont 1, 250 et 350. En K€, une cooptation de 350 K€ serait absurde ; en €, le « 1 » devient une valeur de saisie douteuse. Trois lignes à examiner avant de figer l''unité — décision métier, pas décision de modèle.';
