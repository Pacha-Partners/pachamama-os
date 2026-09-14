-- ── config.branding — SINGLETON
insert into config.branding (cle, libelle, logo_url, logo_mini_url, background_image_url, background_asset1_url, background_asset2_url, police, site_web) values ('pachamama','Pachamama','//98119bfbf8cfc027dc70db6c69918bd3.cdn.bubble.io/f1771511556565x110530339319751420/Pachamama.svg','//98119bfbf8cfc027dc70db6c69918bd3.cdn.bubble.io/f1771706098972x154514769519840770/Group%201321314383.png','//98119bfbf8cfc027dc70db6c69918bd3.cdn.bubble.io/f1773748004381x447277090205210100/Background_2.svg','//98119bfbf8cfc027dc70db6c69918bd3.cdn.bubble.io/f1771836614412x738032833804255600/ACARTA.png','//98119bfbf8cfc027dc70db6c69918bd3.cdn.bubble.io/f1771836599712x158774858622765980/Ellipse%203.png','Host Grotesk','https://www.pachamama.pm');

-- ── config.asset
insert into config.asset (cle, url, description) values ('mail_signature','//98119bfbf8cfc027dc70db6c69918bd3.cdn.bubble.io/f1759743473988x446057645188026940/pachamama_signature.png','Repris de public.ref_image');

-- ── config.parametre — l'interrupteur de redirection des e-mails
insert into config.parametre (cle, valeur, description, sensible) values ('emails_test',coalesce(nullif(current_setting('pacha.email_redirection_test', true), ''), 'a-configurer@exemple.invalid'),'Adresse de redirection des envois en test. Fournie au moment de la poussée — ce dépôt est public. Sensible : l''anonymisation de la dev doit la trouver.',true);

-- ── config.canal_notification — les 2 canaux Slack, SANS leurs webhooks
insert into config.canal_notification (code, libelle) values ('sharpnotifs_jobs','#notifs-jobs');
insert into config.canal_notification (code, libelle) values ('sharpnotifs_closing','#notifs-closing');

-- ── config.modele_email — cree_par_compte_id reste nul : app.compte est vide
insert into config.modele_email (bubble_id, libelle, objet, corps, jeton_agent_prenom, jeton_agent_nom, jeton_entreprise_nom, jeton_talent_prenom, jeton_personnalise) values ('1759733131735x570767434556412200','Rejet sur CV (poste pourvu)','Merci pour ta candidature - {{job_label}}','Hello {{cand_firstname}},

Ton profil est solide, mais nous venons tout juste de recruter quelqu’un pour ce poste et l’offre n’est malheureusement plus d’actualité.

Vu ton parcours, tu as toutes les cartes pour réussir et je ne doute pas que tu trouves rapidement une belle opportunité !🚀

De notre côté, les recrutements continuent et de nouveaux challenges arrivent bientôt.  
N’hésite pas à consulter régulièrement notre app ou à postuler à nouveau si une offre correspond à ton profil.

Bonne chance pour la suite, et au plaisir de recroiser ta route,  

{{agent_firstname}} {{agent_lastname}}
Career Agent @Pachamama
Your single partner for all your recruitment needs: Product, Tech, Sales, Marketing, and People',true,true,false,true,false);
insert into config.modele_email (bubble_id, libelle, objet, corps, jeton_agent_prenom, jeton_agent_nom, jeton_entreprise_nom, jeton_talent_prenom, jeton_personnalise) values ('1759733209529x467784379545927740','Rejet sur CV (profil pas retenu)','Suite à ta candidature – {{job_label}}','Salut {{cand_firstname}},

Merci d’avoir postulé pour le job chez {{company_name}}.  
Nous avons pris le temps d’étudier ton profil, mais nous avons finalement décidé d’avancer avec des candidatures qui correspondent davantage aux besoins de l''entreprise. 

N’hésite pas à consulter régulièrement notre app ou à postuler à nouveau si une offre correspond à ton profil.

Bonne continuation,  

{{agent_firstname}} {{agent_lastname}}
Career Agent @Pachamama
Your single partner for all your recruitment needs: Product, Tech, Sales, Marketing, and People',true,true,true,true,false);
insert into config.modele_email (bubble_id, libelle, objet, corps, jeton_agent_prenom, jeton_agent_nom, jeton_entreprise_nom, jeton_talent_prenom, jeton_personnalise) values ('1759733250753x758665616429697200','Rejet sur CV tardif (avec excuses)','Merci pour ta patience – {{job_label}}','Salut {{cand_firstname}},

Merci encore pour ta candidature et désolé·e pour ce retour tardif !🙏 Nous avons reçu un volume très important de candidatures sur ce rôle, ce qui a un peu rallongé nos délais de réponse.

Après examen de ton profil, nous avons finalement décidé de poursuivre avec d’autres candidats plus proches de ce que nous recherchons aujourd’hui.

On te souhaite plein de réussite pour la suite et espérons {{cand_firstname}} avoir l’occasion de recroiser ton parcours à l’avenir ! 🚀

Bien à toi,  

{{agent_firstname}} {{agent_lastname}}
Career Agent @Pachamama
Your single partner for all your recruitment needs: Product, Tech, Sales, Marketing, and People',true,true,false,true,false);
insert into config.modele_email (bubble_id, libelle, objet, corps, jeton_agent_prenom, jeton_agent_nom, jeton_entreprise_nom, jeton_talent_prenom, jeton_personnalise) values ('1761731950684x536217526130505100','Custom',null,'Bonjour {{cand_firstname}},

J''espère que tu vas bien.
J''ai échangé avec {{manager_firstname}} suite à ton entretien.

Ils ont vraiment apprécié {{custom_1}}.
Malheureusement, ils vont se concentrer sur des profils avec plus de {{custom_2}}.

A ta dispo si tu souhaites en parler.
On reste en contact pour d''autres jobs 🤗

{{agent_firstname}} {{agent_lastname}}
Career Agent @Pachamama
Your single partner for all your recruitment needs: Product, Tech, Sales, Marketing, and People',false,false,false,false,true);

-- ── config.sendgrid_template, et l'éclatement de la chaîne à pipe
insert into config.sendgrid_template (code, libelle_fr, emoji, template_id, ordre) values ('ko_during_process','KO during process','🙅🏻‍♀️','d-4df61af3640d49f2b429597031354ac3',1);
insert into config.sendgrid_template_statut_mandat (sendgrid_template_id, statut) select id, 'en_cours' from config.sendgrid_template where code = 'ko_during_process';
insert into config.sendgrid_template (code, libelle_fr, emoji, template_id, ordre) values ('ko_applicant','KO applicant','🙅🏻‍♀️','d-1776e92d70d34c42af437239189c2688',2);
insert into config.sendgrid_template_statut_mandat (sendgrid_template_id, statut) select id, 'en_cours' from config.sendgrid_template where code = 'ko_applicant';
insert into config.sendgrid_template (code, libelle_fr, emoji, template_id, ordre) values ('free_template','Free template',null,'d-f44451b2f0444f2c8aeb18c10bec9f77',3);
insert into config.sendgrid_template_statut_mandat (sendgrid_template_id, statut) select id, 'en_cours' from config.sendgrid_template where code = 'free_template';
insert into config.sendgrid_template_statut_mandat (sendgrid_template_id, statut) select id, 'close_pachamama' from config.sendgrid_template where code = 'free_template';
insert into config.sendgrid_template (code, libelle_fr, emoji, template_id, ordre) values ('freelance_nbre_de_jours_travailles','Freelance - Nbre de jours travaillés',null,'d-cfa60310d1714024b1736b91567d96f3',4);
insert into config.sendgrid_template_statut_mandat (sendgrid_template_id, statut) select id, 'close_pachamama' from config.sendgrid_template where code = 'freelance_nbre_de_jours_travailles';
insert into config.sendgrid_template (code, libelle_fr, emoji, template_id, ordre) values ('proposition_screening_apres_candidature','Proposition screening après candidature',null,'d-ccc9ae49fdd442b19f88b8dbce9ec1d3',5);
insert into config.sendgrid_template_statut_mandat (sendgrid_template_id, statut) select id, 'en_cours' from config.sendgrid_template where code = 'proposition_screening_apres_candidature';
insert into config.sendgrid_template (code, libelle_fr, emoji, template_id, ordre) values ('onboarding_mandat_close','Onboarding - Mandat closé',null,'d-6ea4cde0bdd34e8492a941104b70c09c',6);
insert into config.sendgrid_template_statut_mandat (sendgrid_template_id, statut) select id, 'close_pachamama' from config.sendgrid_template where code = 'onboarding_mandat_close';

-- ── la correspondance de ces transformations
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine) values ('ref_app_branding','Pachamama','pachamama','referentiel') on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine) values ('ref_image','mail_signature','mail_signature','referentiel') on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine) values ('ref_email_config','Emails Test','emails_test','referentiel') on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine) values ('ref_slack_channel','#notifs-jobs','sharpnotifs_jobs','referentiel') on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine) values ('ref_slack_channel','#notifs-closing','sharpnotifs_closing','referentiel') on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine) values ('email_template','Rejet sur CV (poste pourvu)','1759733131735x570767434556412200','referentiel') on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine) values ('email_template','Rejet sur CV (profil pas retenu)','1759733209529x467784379545927740','referentiel') on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine) values ('email_template','Rejet sur CV tardif (avec excuses)','1759733250753x758665616429697200','referentiel') on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine) values ('email_template','Custom','1761731950684x536217526130505100','referentiel') on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine) values ('ref_sendgrid_template','🙅🏻‍♀️ KO during process','ko_during_process','referentiel') on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine) values ('ref_sendgrid_template','🙅🏻‍♀️ KO applicant','ko_applicant','referentiel') on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine) values ('ref_sendgrid_template','Free template','free_template','referentiel') on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine) values ('ref_sendgrid_template','Freelance - Nbre de jours travaillés','freelance_nbre_de_jours_travailles','referentiel') on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine) values ('ref_sendgrid_template','Proposition screening après candidature','proposition_screening_apres_candidature','referentiel') on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine) values ('ref_sendgrid_template','Onboarding - Mandat closé','onboarding_mandat_close','referentiel') on conflict (referentiel, libelle_miroir) do nothing;