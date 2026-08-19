/**
 * Transformation d'un enregistrement doré (pivot v1) en lignes relationnelles.
 *
 * Module PUR : aucune entrée/sortie, aucune dépendance réseau. C'est ce qui
 * le rend testable unitairement et rejouable à l'identique — la logique de
 * découpage est la partie où une erreur se propagerait à 30 829 talents.
 */
// --- Normalisations -------------------------------------------------------
export const val = (o) => (o && typeof o === 'object' && 'valeur' in o ? o.valeur : o) ?? null;
export const src = (o) => (o && typeof o === 'object' && 'source' in o ? o.source : null);
export const txt = (v) => (v === null || v === undefined || v === '' ? null : String(v));
/** Un tableau PostgREST : on n'envoie jamais [] (bruit), on envoie null. */
export const arr = (v) => {
  if (!v) return null;
  const a = (Array.isArray(v) ? v : [v])
    .map((x) => (x && typeof x === 'object' ? (x.address ?? JSON.stringify(x)) : String(x)))
    .filter(Boolean);
  return a.length ? a : null;
};
export const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// --- Découpage d'un doré en lignes relationnelles -------------------------
export function split(r) {
  const id = r.talent_id;
  const i = r.identite ?? {};
  const talent = {
    talent_id: id,
    type_fusion: r.type_fusion,
    prenom: txt(val(i.prenom)), prenom_src: src(i.prenom),
    nom: txt(val(i.nom)),       nom_src: src(i.nom),
    headline: txt(i.headline),
    localisation: txt(val(i.localisation)), localisation_src: src(i.localisation),
    url_linkedin: txt(i.url_linkedin),
    open_to: txt(i.open_to),
    employeur_actuel: txt(val(r.employeur_actuel)), employeur_src: src(r.employeur_actuel),
    statut_jarvi: txt(r.statut_jarvi),
    origine_jarvi: txt(r.origine_jarvi),
    cv_url: txt(r.documents?.cv),
    notes_jarvi: txt(r.notes_matiere_premiere?.jarvi_notes),
    notes_bloc: null,   // généré ultérieurement par le service LLM
  };
  const sources = (r.sources ?? []).map((s) => ({
    talent_id: id, source: s.source, external_id: String(s.id),
  }));
  const emails = (r.emails ?? []).map((e) => ({
    talent_id: id, email: e.email, source: e.source, generique: !!e.generique,
  }));
  const phones = (r.telephones ?? []).map((p) => ({
    talent_id: id, tel: p.tel, source: p.source,
  }));
  const q = r.qualification_pacha;
  const qualif = q ? [{
    talent_id: id,
    niveau_qualifie: txt(q.niveau_qualifie), univers: txt(q.univers),
    anglais: txt(q.anglais), product: txt(q.product), profil: txt(q.profil),
    seniorite: txt(q.seniorite), background: txt(q.background),
    expertises: arr(q.expertises), secteurs: arr(q.secteurs),
    // `genre` volontairement NON chargé : minimisation RGPD (arbitrage T2 §6.1)
  }] : [];
  const a = r.attentes;
  const attentes = a ? [{
    talent_id: id,
    metier_vise: txt(a['Métier']), univers_vise: txt(a['Univers']),
    contrats: arr(a['Contrats']), localisations: arr(a['Localisations']),
    remotes: arr(a['Remotes']), secteurs: arr(a['Secteurs']),
    nogo: txt(a['NoGo']),
    salaire_min: num(a['Salaire minimum']), salaire_souhaite: num(a['Salaire souhaité']),
    tjm_min: num(a['TJM minimum']), tjm_souhaite: num(a['TJM souhaité']),
    disponibilite: txt(a['Disponibilité']), description: txt(a['Description']),
  }] : [];
  const p = r.parcours_brut_jarvi;
  const parcours = (p && (p.experience || p.formation || p.competences)) ? [{
    talent_id: id,
    experience: txt(p.experience), formation: txt(p.formation), competences: txt(p.competences),
  }] : [];
  return { talent, sources, emails, phones, qualif, attentes, parcours };
}

