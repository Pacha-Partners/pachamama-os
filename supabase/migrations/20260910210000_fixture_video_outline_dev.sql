-- =====================================================================
-- FIXTURE DE DÉVELOPPEMENT — une vidéo sur le mandat OUTLINE
--
-- POURQUOI. `mandat.video_youtube` est NUL sur les 548 mandats de la
-- production. La colonne existe pourtant dans le miroir, le connecteur n8n
-- la remplit depuis le champ Bubble « Vidéo Youtube », la reprise la
-- transporte vers core.mandat (reprise/05:26) et la vue api.offre_detail
-- l'expose (:91). Toute la chaîne est en place et n'a jamais rien porté.
--
-- Conséquence : le bloc vidéo de la fiche d'offre n'a JAMAIS pu être vu.
-- Cette migration lui donne de quoi s'afficher, sur un seul mandat.
--
-- ⚠️ DEV UNIQUEMENT. C'est une donnée inventée, pas une correction. Elle
-- ne doit jamais atteindre la production, et le refus est écrit dans le
-- SQL plutôt que confié à la mémoire de celui qui lance `db push` : le
-- projet de production héberge l'application Avant-garde et porte donc le
-- schéma `avant_garde`, que le projet de développement n'a pas. La
-- migration se contente d'un avertissement si elle s'y retrouve.
--
-- POUR RETIRER LA FIXTURE :
--   update public.mandat set video_youtube = null
--    where reprise.uid(id) = '76c0510e-73f0-5368-8e07-1b5710def9ba';
--   update core.mandat   set video_youtube = null
--    where id            = '76c0510e-73f0-5368-8e07-1b5710def9ba';
-- =====================================================================

do $$
declare
  -- Le mandat « Founding Engineer » d'Outline : la seule offre publiée non
  -- anonyme, donc celle dont la fiche montre le plus de blocs à la fois.
  cible constant uuid := '76c0510e-73f0-5368-8e07-1b5710def9ba';

  -- Un identifiant YouTube RÉEL, emprunté à `entreprise.video` faute d'en
  -- trouver un seul sur un mandat. Sa provenance ne porte aucun sens ici :
  -- il ne sert qu'à faire jouer l'iframe. À remplacer par le vrai
  -- identifiant du mandat le jour où le miroir en rapportera un.
  video constant text := 'Hg8K0rJ2LtU';

  n_miroir  integer;
  n_modele  integer;
begin
  if to_regnamespace('avant_garde') is not null then
    raise warning 'fixture vidéo IGNORÉE : le schéma avant_garde est présent, '
                  'donc cette base est la PRODUCTION. Aucune écriture.';
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

  -- Le miroir ET le modèle, pour que la chaîne reste cohérente : écrire le
  -- seul modèle ferait disparaître la fixture au prochain rejeu de la reprise.
  insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
  values (
    'fixture_video_outline_dev',
    'public.mandat + core.mandat',
    2, n_miroir + n_modele, 2 - (n_miroir + n_modele),
    format('fixture DEV : video_youtube=%s sur le mandat %s — miroir %s ligne(s), '
           'modèle %s ligne(s). 0 et 0 signifie « déjà posée », pas un échec.',
           video, cible, n_miroir, n_modele)
  );

  raise notice 'fixture vidéo posée : miroir % ligne(s), modèle % ligne(s)', n_miroir, n_modele;
end
$$;
