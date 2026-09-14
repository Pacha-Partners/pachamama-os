import { describe, expect, it } from "vitest";
import { idVideoYoutube, listeDe, versFiche } from "./fiche";

/**
 * Les formes RÉELLES rencontrées dans la base, relevées le 10/09 sur les douze
 * offres publiées. Ces tests figent ce que la page doit savoir absorber, pas ce
 * qu'on aimerait que la saisie soit.
 */
describe("listeDe — les textes libres saisis dans Bubble", () => {
  it("déplie un tableau JSON sérialisé en texte", () => {
    expect(
      listeDe(
        '["Définir le positionnement et la vision produit","Contribuer à la roadmap"]',
      ),
    ).toEqual([
      "Définir le positionnement et la vision produit",
      "Contribuer à la roadmap",
    ]);
  });

  it("retire les chiffres encerclés d'un processus, que la liste <ol> renumérote", () => {
    expect(
      listeDe("1️⃣ Pachamama\n2️⃣ Call TAM\n3️⃣ Entretien manager\n"),
    ).toEqual(["Pachamama", "Call TAM", "Entretien manager"]);
  });

  it("retire les ✅ de tête, que la puce remplace", () => {
    expect(
      listeDe("✅ Tu as une double culture\n✅ Tu sais influencer"),
    ).toEqual(["Tu as une double culture", "Tu sais influencer"]);
  });

  it("retire tirets et numéros de tête", () => {
    expect(listeDe("- Un\n• Deux\n3. Trois\n4) Quatre")).toEqual([
      "Un",
      "Deux",
      "Trois",
      "Quatre",
    ]);
  });

  it("garde un pictogramme qui n'est pas en tête — c'est du contenu", () => {
    expect(listeDe("Tu aimes la tech 🚀 pour la tech")).toEqual([
      "Tu aimes la tech 🚀 pour la tech",
    ]);
  });

  it("ne prend pas une date de début de ligne pour une numérotation", () => {
    expect(listeDe("2024 a été une année de structuration")).toEqual([
      "2024 a été une année de structuration",
    ]);
  });

  it("laisse intact un texte qui commence par un crochet sans être du JSON", () => {
    expect(listeDe("[à confirmer] le périmètre")).toEqual([
      "[à confirmer] le périmètre",
    ]);
  });

  it("jette les lignes vides et les puces orphelines", () => {
    expect(listeDe("•\n\n- \nUn seul élément")).toEqual(["Un seul élément"]);
  });

  it("rend un tableau vide sur une absence — c’est lui qui fait disparaître le bloc", () => {
    expect(listeDe(null)).toEqual([]);
    expect(listeDe("")).toEqual([]);
    expect(listeDe("   \n  ")).toEqual([]);
  });
});

describe("versFiche — le futur manager", () => {
  it("reprend les trois champs que la vue compose", () => {
    const f = versFiche({
      id: "1",
      manager_nom: "Tristan F.",
      manager_photo: "https://exemple.test/pho-1",
      manager_titre: "CEO",
    });
    expect([f.managerNom, f.managerPhoto, f.managerTitre]).toEqual([
      "Tristan F.",
      "https://exemple.test/pho-1",
      "CEO",
    ]);
  });

  it("n'invente rien quand la vue les taît — offre anonyme ou manager absent", () => {
    // La vue rend `null` sur les deux cas, et ils sont indiscernables ici :
    // c'est voulu. Le composant affiche « - » dans les deux, et la décision de
    // sécurité reste en base.
    const f = versFiche({ id: "1" });
    expect([f.managerNom, f.managerPhoto, f.managerTitre]).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("accepte un manager nommé sans photo ni métier", () => {
    const f = versFiche({ id: "1", manager_nom: "Camille P." });
    expect(f.managerNom).toBe("Camille P.");
    expect(f.managerPhoto).toBeNull();
    expect(f.managerTitre).toBeNull();
  });
});

/**
 * Le champ Bubble `z_vidéo_yt` porte un identifiant NU. Aucun mandat n'en
 * portait quand la fonction a été écrite : elle n'acceptait que des URL et
 * aurait rendu `null` sur 100 % des données réelles. Ces cas figent les deux
 * formes, et surtout la première.
 */
describe("idVideoYoutube — ce que la base porte vraiment", () => {
  it("accepte l'identifiant nu, le format réel de Bubble", () => {
    expect(idVideoYoutube("Hg8K0rJ2LtU")).toBe("Hg8K0rJ2LtU");
    expect(idVideoYoutube("00ortRZ7ho8")).toBe("00ortRZ7ho8");
    expect(idVideoYoutube("esW284uVQbM")).toBe("esW284uVQbM");
  });

  it("tolère les espaces autour de l'identifiant", () => {
    expect(idVideoYoutube("  Hg8K0rJ2LtU\n")).toBe("Hg8K0rJ2LtU");
  });

  it("accepte encore les quatre formes d'URL", () => {
    expect(idVideoYoutube("https://youtu.be/Hg8K0rJ2LtU")).toBe("Hg8K0rJ2LtU");
    expect(idVideoYoutube("https://www.youtube.com/watch?v=Hg8K0rJ2LtU")).toBe(
      "Hg8K0rJ2LtU",
    );
    expect(idVideoYoutube("https://www.youtube.com/embed/Hg8K0rJ2LtU")).toBe(
      "Hg8K0rJ2LtU",
    );
    expect(idVideoYoutube("https://youtube.com/shorts/Hg8K0rJ2LtU")).toBe(
      "Hg8K0rJ2LtU",
    );
  });

  it("refuse ce qui n'est ni une URL ni un identifiant de onze caractères", () => {
    expect(idVideoYoutube(null)).toBeNull();
    expect(idVideoYoutube("")).toBeNull();
    expect(idVideoYoutube("Hybride")).toBeNull();
    expect(idVideoYoutube("à venir")).toBeNull();
    expect(idVideoYoutube("https://vimeo.com/123456789")).toBeNull();
  });

  it("ne laisse jamais passer une valeur qui finirait telle quelle dans le src", () => {
    expect(idVideoYoutube('" onerror="alert(1)')).toBeNull();
    // Une URL piégée ne rend QUE l'identifiant, jamais la queue de la chaîne :
    // c'est la raison d'être de l'extraction plutôt que d'un passe-plat.
    expect(
      idVideoYoutube('https://youtu.be/Hg8K0rJ2LtU"><script>alert(1)</script>'),
    ).toBe("Hg8K0rJ2LtU");
  });
});
