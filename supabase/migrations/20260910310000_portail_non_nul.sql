-- =====================================================================
-- `portail` devient NOT NULL — le trou laissé par la dégénération
--
-- Tant que la colonne était GÉNÉRÉE, elle ne pouvait pas être nulle : elle
-- se calculait. Depuis qu'elle est déclarée, un INSERT qui l'omet écrit
-- NULL — et `acces_portail_coherent` ne le rattrape PAS, parce qu'une
-- contrainte CHECK qui s'évalue à NULL est considérée comme SATISFAITE.
-- Un accès sans portail passerait donc en silence, et n'ouvrirait rien.
--
-- C'est exactement le cas des scripts de `backend/database/reprise/`, qui
-- insèrent sans mentionner le portail : ils étaient justes tant qu'il se
-- calculait. Le NOT NULL les fera échouer franchement plutôt que produire
-- des accès muets. Ils sont mis à jour dans le même lot.
-- =====================================================================

do $$
declare n integer;
begin
  select count(*) into n from app.acces where portail is null;
  if n > 0 then
    raise exception 'REFUS : % accès ont déjà un portail nul. Les corriger avant de poser la contrainte.', n;
  end if;
end
$$;

alter table app.acces alter column portail set not null;
