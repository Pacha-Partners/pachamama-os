-- =====================================================================
-- LES CONTRAINTES QUI NE POUVAIENT ÊTRE POSÉES QU'APRÈS LE CHARGEMENT
--
-- Six contraintes attendaient ce moment, et c'est délibéré. « NOT VALID »
-- dispense du contrôle les lignes DÉJÀ présentes mais vérifie toutes les
-- insertions suivantes : posées avant la reprise, elles auraient rejeté
-- exactement les lignes qu'elles étaient censées épargner.
--
-- Maintenant que les données sont là, elles protègent l'avenir sans
-- toucher au passé.
-- =====================================================================

-- ── une ligne de contact doit être identifiable
-- 92 des 524 contacts n'ont pas d'e-mail ; certains n'ont ni nom ni prénom.
alter table core.contact_client
  add constraint contact_identifiable
  check (nom is not null or prenom is not null or email is not null) not valid;

-- ── un tag se rattache à au plus une chose
alter table core.tag
  add constraint tag_une_seule_attache
  check (num_nonnulls(entreprise_id, mandat_id) <= 1) not valid;

-- ── les trois contraintes que la MESURE avait refusées
-- mandat : 2 lignes ont un salaire minimum supérieur au maximum
alter table core.mandat
  add constraint mandat_salaire_ordre
  check (salaire_min_ke is null or salaire_max_ke is null or salaire_min_ke <= salaire_max_ke) not valid;

-- placement : 1 ligne finit sa mission avant de la commencer
alter table core.placement
  add constraint placement_dates_mission
  check (date_fin_mission is null or date_debut_mission is null
         or date_fin_mission >= date_debut_mission) not valid;

-- placement : 1 ligne voit sa garantie finir avant le closing
alter table core.placement
  add constraint placement_garantie_apres_closing
  check (date_fin_garantie is null or date_fin_garantie >= date_closing) not valid;

-- ── un compte sans accès n'ouvre sur rien
-- Vérifié à la reprise : 0 compte orphelin. Le déclencheur est différé au
-- COMMIT, ce qui laisse le temps de créer le compte puis son accès dans la
-- même transaction.
create constraint trigger compte_a_un_acces
  after insert on app.compte
  deferrable initially deferred
  for each row execute function app.verifier_compte_a_un_acces();

-- ---------------------------------------------------------------------
-- Les vues de contrôle qui remplacent les contraintes impossibles.
-- Une contrainte qui rejette est parfois pire qu'un signalement : ces
-- trois cas sont des incohérences RÉELLES qu'il faut voir, pas interdire.
-- ---------------------------------------------------------------------

create or replace view core.v_secteur_vise_et_nogo as
select v.fiche_talent_id, s.libelle_fr as secteur
from core.fiche_talent_secteur_vise v
join core.fiche_talent_secteur_nogo n
  on n.fiche_talent_id = v.fiche_talent_id and n.secteur_id = v.secteur_id
join ref.secteur s on s.id = v.secteur_id;
comment on view core.v_secteur_vise_et_nogo is
  'Un secteur à la fois visé et interdit par la même personne. Incohérence de saisie réelle : à faire remonter, pas à rejeter — la reprise échouerait.';

create or replace view core.v_candidature_en_double as
select fiche_talent_id, mandat_id, count(*) as candidatures
from core.candidature
where fiche_talent_id is not null and mandat_id is not null
group by 1,2 having count(*) > 1;
comment on view core.v_candidature_en_double is
  'Deux candidatures pour le même couple talent × mandat. Remplace l''unicité que la mesure interdisait de poser : une recandidature après un KO est un cas métier légitime.';

create or replace view core.v_repartition_incoherente as
select r.id, r.placement_id, r.total_montant_eur, p.commission_ke,
       round(r.total_montant_eur - p.commission_ke * 1000, 2) as ecart_eur
from core.repartition_commission r
join core.placement p on p.id = r.placement_id
where r.total_montant_eur is not null and p.commission_ke is not null
  and abs(r.total_montant_eur - p.commission_ke * 1000) > 1;
comment on view core.v_repartition_incoherente is
  'Le total réparti ne retombe pas sur la commission du placement. Attention aux unités : la répartition est en euros, la commission en K€. Remplace la contrainte d''égalité, impossible car la formule d''origine est inconnue.';
