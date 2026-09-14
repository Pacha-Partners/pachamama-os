-- =====================================================================
-- ref.tag_job — LA SOURCE DU MIROIR EST DÉTRUITE
--
-- Découvert le 28/08/2026 en préparant l'amorçage. Le détail annonçait
-- « 74 tags » et signalait qu'une 16e valeur, « Job exclu », n'avait
-- jamais existé au référentiel Bubble. La réalité est plus grave : ce
-- n'est pas une valeur qui manque, c'est le référentiel entier qui n'en
-- est plus un.
--
-- public.ref_tag_job contient 74 lignes portant CHACUNE UN SEUL
-- CARACTÈRE, avec un sort_order qui court jusqu'à 1899. Concaténées dans
-- l'ordre, elles donnent :
--     "display:🌱 Cronce,/3.mzwft_u167892405x-%vg}🌎I🦄L☄️Bîà🫰MSPE🏝F🐓R🌈Déb💼✌🚀🧱🔧’🎯💸è
-- soit les débris d'une chaîne explosée caractère par caractère, dont
-- les doublons ont été absorbés — d'où 74 caractères distincts pour un
-- sort_order allant à 1899. Les « 74 tags » et le « icone_url 0/74 » du
-- détail sont des chiffres tirés de ces débris.
--
-- LE VOCABULAIRE RÉEL EST RECONSTRUCTIBLE, et il l'est intégralement :
-- public.mandat_tag_job porte 833 lignes et 16 valeurs distinctes, toutes
-- des libellés complets. C'est de LÀ que ref.tag_job doit être amorcée,
-- jamais de ref_tag_job.
--
--    152 🐓 Boîte FR              37 🎯 Product-led
--     85 🌱 Croissance saine      34 🏝️ Full remote
--     82 🔧 Cas d'usage concrets  25 🧱 Intrapreneuriat
--     75 🌎 International         25 🚀 Lancement de produit
--     75 💼 Career-move           18 Job exclu
--     74 💸 Stabilité financière  15 🫰 Max de BSPCE
--     69 ✌️ Cible users sympa      9 🌈 Diversité
--     57 ☄️ Boîte à impact         1 🦄 Licorne
--
-- Conséquences pour la reprise, dans l'ordre :
--   1. amorcer ref.tag_job depuis ces 16 valeurs, en séparant l'emoji du
--      libellé comme le prévoit le modèle ;
--   2. « Job exclu » est le seul sans emoji ET le seul qui ne décrive pas
--      un attrait du poste — c'est un drapeau d'exclusion. À arbitrer :
--      un tag comme les autres, ou une colonne du mandat ?
--   3. icone_url naît vide, non pas parce que le contenu est perdu mais
--      parce que la source qui était censée le porter n'a jamais été un
--      référentiel.
-- =====================================================================

comment on table ref.tag_job is
  'Les 16 tags d''attrait d''un poste. AMORÇAGE : reconstruire depuis les 16 valeurs distinctes de public.mandat_tag_job (833 lignes), et JAMAIS depuis public.ref_tag_job, qui est détruit — 74 lignes d''un caractère chacune, débris d''une chaîne explosée. Voir la migration 20260828203000.';

comment on column ref.tag_job.icone_url is
  'Naît vide. Non pas « contenu perdu » comme l''annonçait le détail, mais source inexistante : public.ref_tag_job n''a jamais été un référentiel exploitable.';

comment on column ref.tag_job.origine is
  '« hors_referentiel » pour les 16 valeurs, toutes reconstruites depuis l''usage : aucune ne provient d''un référentiel Bubble valide.';
