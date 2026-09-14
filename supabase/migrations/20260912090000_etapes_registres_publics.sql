-- ═══════════════════════════════════════════════════════════════════════════
-- Les trois registres d'une étape de process, et qui voit quoi.
--
-- `ref.etape_process` porte trois registres de libellé : l'interne (peuplé),
-- le client et le talent (NULL tous les deux). La table source Bubble est
-- DÉTRUITE — 70 lignes contenant chacune un caractère isolé. Le contenu public
-- est perdu, il n'est pas récupérable : les libellés ci-dessous sont écrits,
-- pas restaurés. Décision D-02 du journal.
--
-- Conséquence de l'état actuel, mesurée le 09/09 avec de vrais jetons : les
-- vues replient sur `libelle_interne`, et un client comme un candidat lisent
-- « 🙅🏻‍♀️ KO by Pachamama ».
--
-- Les quatre drapeaux de visibilité sont NULL sur les 14 lignes. La règle
-- d'usage inscrite au modèle est « NULL ⇒ non visible, fermeture par défaut » ;
-- le SQL, lui, ne filtrait rien du tout. On les déclare.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Le registre client. Six étapes seulement (décision D-03).
-- Rien avant le send-out : le client ne doit pas voir les candidats que le
-- cabinet écarte avant de les lui présenter. `KO by client` est visible parce
-- que le client est l'auteur de cette décision.
update ref.etape_process set libelle_client = null,             visible_client = false where code in
  ('to_contact','contacted','applicant','push_candidature','screen_pachamama','ko','ko_by_pachamama','ko_by_candidat');

update ref.etape_process set libelle_client = 'Profil présenté',        visible_client = true where code = 'send_out';
update ref.etape_process set libelle_client = 'Premier entretien',      visible_client = true where code = 'interview_1';
update ref.etape_process set libelle_client = 'Deuxième entretien',     visible_client = true where code = 'interview_2';
update ref.etape_process set libelle_client = 'Entretien final',        visible_client = true where code = 'final_interview';
update ref.etape_process set libelle_client = 'Recruté·e',              visible_client = true where code = 'hired';
update ref.etape_process set libelle_client = 'Écarté·e par vos soins', visible_client = true where code = 'ko_by_client';

-- ── 2. Le registre talent. Les quatorze, parce qu'un candidat voit toujours
-- sa propre candidature, où qu'elle en soit.
-- Les trois variantes de KO se replient sur « Candidature close » : dire à
-- quelqu'un « écarté par Pachamama » plutôt que « par le client » l'expose sans
-- l'aider. Le motif détaillé reste interne et se transmet à la main.
update ref.etape_process set libelle_talent = 'Candidature reçue'          where code in ('to_contact','applicant','push_candidature');
update ref.etape_process set libelle_talent = 'Premier échange'            where code = 'contacted';
update ref.etape_process set libelle_talent = 'Entretien Pachamama'        where code = 'screen_pachamama';
update ref.etape_process set libelle_talent = 'Profil transmis au client'  where code = 'send_out';
update ref.etape_process set libelle_talent = 'Premier entretien client'   where code = 'interview_1';
update ref.etape_process set libelle_talent = 'Deuxième entretien client'  where code = 'interview_2';
update ref.etape_process set libelle_talent = 'Entretien final'            where code = 'final_interview';
update ref.etape_process set libelle_talent = 'Recruté·e'                  where code = 'hired';
update ref.etape_process set libelle_talent = 'Candidature close'          where code in ('ko','ko_by_pachamama','ko_by_client');
update ref.etape_process set libelle_talent = 'Candidature retirée'        where code = 'ko_by_candidat';

-- ── 3. Le kanban interne montre tout, y compris les colonnes de perte.
update ref.etape_process set visible_interne = true;

-- ── 4. `est_publique` — ex `is_public`, dont la sémantique d'origine est
-- perdue (mesurée vraie sur zéro ligne). On la lie au registre client pour
-- qu'elle cesse d'être NULL, et on le dit : le code neuf lit `visible_client`.
update ref.etape_process set est_publique = visible_client;

-- ── 5. Les couleurs, alignées sur les jetons de statut du design system
-- (`--statut-attente`, `--statut-avance`, `--statut-positif`, `--statut-echec`).
-- L'en-tête de colonne emploie la même teinte que la pastille, en basse opacité.
update ref.etape_process set couleur_pastille = '#FFEA4D' where code in
  ('to_contact','contacted','applicant','push_candidature','screen_pachamama','interview_1','interview_2','final_interview');
update ref.etape_process set couleur_pastille = '#8657FF' where code = 'send_out';
update ref.etape_process set couleur_pastille = '#79E6BE' where code = 'hired';
update ref.etape_process set couleur_pastille = '#F4728A' where code in ('ko','ko_by_pachamama','ko_by_client','ko_by_candidat');
update ref.etape_process set couleur_colonne = couleur_pastille;

-- ── 6. Le filet de sécurité : plus aucune de ces colonnes ne peut redevenir
-- NULL sans qu'on s'en aperçoive. Un CHECK évalué à NULL est réputé satisfait,
-- piège déjà payé sur `app.acces.portail` — d'où les NOT NULL explicites.
alter table ref.etape_process
  alter column visible_client  set not null,
  alter column visible_interne set not null,
  alter column est_publique    set not null,
  alter column libelle_talent  set not null;

alter table ref.etape_process
  add constraint etape_libelle_client_si_visible
  check (not visible_client or libelle_client is not null);

comment on column ref.etape_process.libelle_client is
  'Registre client. NULL quand l''étape ne lui est pas montrée. ÉCRIT le 09/09/2026, pas restauré : la source Bubble est détruite.';
comment on column ref.etape_process.libelle_talent is
  'Registre talent. Les trois KO se replient sur « Candidature close » — décision D-02.';
comment on column ref.etape_process.est_publique is
  'HÉRITÉE. Sémantique d''origine perdue ; synonyme de visible_client depuis le 09/09. Le code neuf lit visible_client.';

-- ── 7. Ce qui manquera toujours à la vue client : savoir si une candidature
-- aujourd'hui écartée est passée par le send-out. L'historique d'étapes n'existe
-- nulle part (colonnes sources vides à 100 %, `app.transition_etape` vide).
-- La colonne démarre vide et se remplit d'elle-même à partir de maintenant.
alter table core.candidature add column if not exists presente_le timestamptz;
comment on column core.candidature.presente_le is
  'Premier passage au send-out. Vide sur l''historique — il n''est pas reconstituable. Écrite par api.avancer_candidature() à partir du 09/09/2026.';
