-- =====================================================================
-- SÉPARER LE BACK-OFFICE DU RECRUTEUR — 1/2 : les valeurs d'énuméré
--
-- Cette migration ne fait QUE deux `add value`, et c'est une obligation :
-- PostgreSQL refuse qu'une valeur d'énuméré ajoutée soit EMPLOYÉE dans la
-- transaction qui l'ajoute. Tout le reste attend la migration suivante.
--
-- POURQUOI CE CHANGEMENT. Le modèle traitait « interne » comme une surface
-- unique, dont admin, recruteur et support étaient des graduations. Le
-- dirigeant a tranché l'inverse : administrer et recruter sont deux métiers
-- aux fonctionnalités distinctes, donc deux surfaces, donc deux portails.
--
-- Et les données le disaient déjà. Trois personnes portent dans Bubble À LA
-- FOIS le rôle « Admin » ET « Recruiter Core Team » — Marion Darnet, Arnaud
-- Lahy, Andréa Bollard. La reprise les a écrasées : son `case` ne retient
-- qu'un rôle, et l'index unique sur collaborateur_id interdisait la seconde
-- ligne. Ces trois-là ont perdu une casquette au passage. La correction ne
-- fait pas qu'ouvrir un cas futur : elle répare une perte déjà subie.
--
-- « interne » n'est pas retiré : on ne supprime pas proprement une valeur
-- d'énuméré dans PostgreSQL. Elle deviendra inemployée, et la contrainte
-- `acces_portail_coherent` de la migration suivante l'interdira de fait.
-- Même raisonnement pour « superadmin », déjà présent et porté par personne.
-- =====================================================================

alter type app.portail add value if not exists 'recruteur';
alter type app.portail add value if not exists 'backoffice';
