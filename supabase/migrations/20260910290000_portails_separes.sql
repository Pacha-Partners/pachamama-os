-- =====================================================================
-- SÉPARER LE BACK-OFFICE DU RECRUTEUR — 2/2 : le modèle
--
-- Quatre portails : talent · entreprise · recruteur · backoffice.
--
-- CE QUI CHANGE DE NATURE. `portail` cesse d'être une colonne GÉNÉRÉE. Elle
-- l'était parce qu'elle se déduisait du type de personne — fiche talent,
-- contact client, collaborateur. Deux portails naissant désormais tous deux
-- d'un collaborateur, la déduction n'est plus possible : le portail devient
-- une donnée DÉCLARÉE, encadrée par une contrainte de compatibilité.
--
-- CE QUI CHANGE DE SENS. `role_interne` n'est plus « quel pouvoir interne ».
-- Il devient la graduation À L'INTÉRIEUR d'un portail :
--     portail recruteur   → rôle recruteur | support
--     portail backoffice  → rôle admin | superadmin
-- Ce qui répond au passage à « où va support » : c'est une nuance du portail
-- recruteur, pas une surface à part.
--
-- CE QUI DEVIENT POSSIBLE. `acces_collab_unique` portait sur le seul
-- collaborateur_id : une fiche collaborateur ne pouvait avoir qu'UN accès
-- dans toute la base. C'est cet index — et lui seul — qui interdisait de
-- cumuler. Il passe sur (collaborateur_id, portail).
--
-- CE QUI EST RÉPARÉ. Trois personnes portent dans Bubble « Admin » ET
-- « Recruiter Core Team ». La reprise n'en gardait qu'un rôle. Elles
-- reçoivent ici leur seconde ligne d'accès.
--
-- CE QUI N'A PAS BESOIN D'ÊTRE TOUCHÉ. Les 4 policies et les boucles sur 35
-- et 32 tables de core s'appuient sur `api.est_interne()`. Elles APPELLENT
-- la fonction : la redéfinir suffit, aucune policy n'est réécrite.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Le portail cesse d'être calculé, sans perdre ses valeurs
-- ---------------------------------------------------------------------
alter table app.acces alter column portail drop expression;

-- ---------------------------------------------------------------------
-- 2. « interne » se scinde
-- ---------------------------------------------------------------------
update app.acces
   set portail = case when role_interne in ('admin','superadmin')
                      then 'backoffice'::app.portail
                      else 'recruteur'::app.portail end
 where portail = 'interne';

-- ---------------------------------------------------------------------
-- 3. L'index qui interdisait le cumul
-- ---------------------------------------------------------------------
alter table app.acces drop constraint acces_role_si_interne;
drop index if exists app.acces_collab_unique;
create unique index acces_collab_portail_unique
    on app.acces (collaborateur_id, portail) where collaborateur_id is not null;

-- ---------------------------------------------------------------------
-- 4. Les trois casquettes perdues à la reprise
-- ---------------------------------------------------------------------
insert into app.acces (compte_id, collaborateur_id, portail, role_interne, actif)
select a.compte_id, a.collaborateur_id, 'recruteur'::app.portail,
       (case when exists (select 1 from public.user_role ur
                           where ur.user_id = c.bubble_id
                             and ur.role = 'Recruiter Support Crew')
             then 'support' else 'recruteur' end)::app.role_interne,
       true
  from app.acces a
  join core.collaborateur c on c.id = a.collaborateur_id
 where a.portail = 'backoffice'
   and exists (select 1 from public.user_role ur
                where ur.user_id = c.bubble_id
                  and ur.role in ('Recruiter Core Team','Recruiter Support Crew'))
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 5. Les contraintes qui remplacent le calcul
-- ---------------------------------------------------------------------
alter table app.acces add constraint acces_portail_coherent check (
      (portail = 'talent'     and fiche_talent_id   is not null)
   or (portail = 'entreprise' and contact_client_id is not null)
   or (portail in ('recruteur','backoffice') and collaborateur_id is not null)
);

alter table app.acces add constraint acces_role_selon_portail check (
      (portail = 'recruteur'  and role_interne in ('recruteur','support'))
   or (portail = 'backoffice' and role_interne in ('admin','superadmin'))
   or (portail in ('talent','entreprise') and role_interne is null)
);

comment on column app.acces.portail is
  'La SURFACE que cet accès ouvre. Déclarée, plus calculée : deux portails naissent d''un collaborateur, la déduction depuis le type de personne n''est donc plus possible. `acces_portail_coherent` tient la compatibilité.';
comment on column app.acces.role_interne is
  'La graduation À L''INTÉRIEUR d''un portail interne : recruteur|support sur `recruteur`, admin|superadmin sur `backoffice`. Ce n''est plus le pouvoir lui-même — le pouvoir, c''est le portail.';
