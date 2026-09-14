-- =====================================================================
-- FIXTURE DE DÉVELOPPEMENT — le vrai identifiant de la vidéo OUTLINE
--
-- Remplace la valeur arbitraire posée par 20260910210000, qui n'avait été
-- empruntée à `entreprise.video` que pour faire jouer l'iframe. Celui-ci
-- est l'identifiant réel, fourni par le dirigeant.
--
-- ⚠️ DEV UNIQUEMENT, même garde que la précédente : le projet de production
-- héberge l'application Avant-garde et porte donc le schéma `avant_garde`,
-- que le projet de développement n'a pas. La migration s'y contente d'un
-- avertissement, sans écrire.
--
-- Reste une donnée POSÉE À LA MAIN. Le champ Bubble « Vidéo Youtube » est
-- nul sur les 548 mandats de la production : tant que la synchronisation
-- n'en rapporte pas, ce mandat est le seul de toute la base à porter une
-- vidéo, et c'est nous qui la lui avons mise.
-- =====================================================================

do $$
declare
  cible constant uuid := '76c0510e-73f0-5368-8e07-1b5710def9ba';  -- Outline · Founding Engineer
  video constant text := 'I3wxNbtqQgw';
  n_miroir integer;
  n_modele integer;
begin
  if to_regnamespace('avant_garde') is not null then
    raise warning 'fixture vidéo IGNORÉE : schéma avant_garde présent, donc PRODUCTION. Aucune écriture.';
    return;
  end if;

  update public.mandat
     set video_youtube = video
   where reprise.uid(id) = cible
     and video_youtube is distinct from video;
  get diagnostics n_miroir = row_count;

  update core.mandat
     set video_youtube = video
   where id = cible
     and video_youtube is distinct from video;
  get diagnostics n_modele = row_count;

  insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
  values (
    'fixture_video_outline_id_reel',
    'public.mandat + core.mandat',
    2, n_miroir + n_modele, 2 - (n_miroir + n_modele),
    format('fixture DEV : video_youtube=%s (identifiant réel) sur le mandat %s — '
           'miroir %s ligne(s), modèle %s ligne(s).', video, cible, n_miroir, n_modele)
  );

  raise notice 'vrai identifiant posé : miroir % ligne(s), modèle % ligne(s)', n_miroir, n_modele;
end
$$;
