# Les défauts

Le registre du test humain. **Trois phases sur quatre ne se ferment que sur son
contenu** — c'est ici qu'on le vérifie, et la vérification est une commande, pas
une affirmation.

| phase | ce qui l'empêche de se fermer |
|---|---|
| alpha 1, alpha 2 | un défaut `bloquant` à l'état `ouvert` |
| **beta** | **n'importe quel défaut à l'état `ouvert`**, quelle que soit sa gravité |
| v1.0 | — elle n'a pas de critère propre, c'est la sortie de beta qui la déclenche |

---

## Écrire une ligne

Une ligne par défaut, **ajoutée à la fin du tableau**. On ne déplace jamais une
ligne : c'est la colonne `état` qui change.

| colonne | ce qu'on y met |
|---|---|
| **id** | `DEF-01`, `DEF-02`… dans l'ordre, **jamais réutilisé**, même après correction |
| **le** | date de constat, `JJ/MM` |
| **phase** | `alpha 1`, `alpha 2`, `beta` |
| **où** | `talent`, `entreprise`, `recruteur`, `backoffice`, `job board`, `connexion` |
| **gravité** | `bloquant`, `gênant` ou `cosmétique` — un seul mot, en minuscules |
| **état** | `ouvert`, `corrigé` ou `écarté` — un seul mot, en minuscules |
| **ce qui se passe** | ce qu'on faisait, et ce qui est arrivé à la place de ce qu'on attendait |

⚠ **`gravité` et `état` sont lus par une commande.** Un mot, en minuscules, sans
rien d'autre dans la cellule — `bloquant`, pas « plutôt bloquant ». Le reste de
la phrase va dans la dernière colonne.

### La gravité, et elle seule ferme une alpha

> **`bloquant`** — la tâche ne peut pas être menée à son terme, ou une donnée
> part chez la mauvaise personne.
>
> **`gênant`** — la tâche aboutit, mais par un détour, ou avec une information
> fausse à l'écran qui ne sort pas de l'écran.
>
> **`cosmétique`** — ni l'un ni l'autre.

Un doute se tranche vers le haut. Un `gênant` qu'on rétrograde plus tard ne coûte
rien ; un `bloquant` découvert en beta coûte la confiance d'un client.

### Ce qu'on note, au-delà du défaut

Trois choses se rapportent, et la troisième est la plus utile :

1. ce qui **bloque** ;
2. ce qui **surprend** ;
3. ce qu'on a **cherché sans le trouver**.

La troisième ne remonte presque jamais spontanément — personne ne signale une
absence. Elle se note en `gênant`, avec « je cherchais X, je ne l'ai pas trouvé ».

---

## Le registre

| id | le | phase | où | gravité | état | ce qui se passe |
|---|---|---|---|---|---|---|
| DEF-00 | 22/09 | alpha 1 | talent | gênant | corrigé | *(ligne d'exemple, à imiter puis laisser)* je cherchais où changer mon adresse ; je l'ai trouvée dans « ma fiche » alors que je l'attendais dans « mon compte » |

---

## Vérifier un critère de sortie

Fermer une **alpha** — aucun `bloquant` encore `ouvert` :

```bash
awk -F'|' '$2 ~ /DEF-/ {g=$6; e=$7; gsub(/ /,"",g); gsub(/ /,"",e); if (tolower(g)=="bloquant" && tolower(e)=="ouvert") n++} END {print n+0}' docs/DEFAUTS.md
```

Fermer la **beta** — plus aucun défaut `ouvert`, de quelque gravité :

```bash
awk -F'|' '$2 ~ /DEF-/ {e=$7; gsub(/ /,"",e); if (tolower(e)=="ouvert") n++} END {print n+0}' docs/DEFAUTS.md
```

Les deux doivent rendre `0`. Elles ne lisent que les lignes dont la première
cellule porte un `DEF-`, donc ni le texte de cette page, ni les exemples, ni
elles-mêmes.

⚠ **Ce registre ne couvre que le test humain.** Ce qu'un harnais attrape se
corrige dans le même mouvement et n'a pas à être consigné ici : un défaut qui
tombe sous une assertion n'a jamais besoin d'être décrit à la main.

⚠ **`DEF-`, et non `D-`.** Le préfixe `D-` désigne déjà les 28 décisions de
`JOURNAL_DECISIONS.md`, et dix-huit d'entre elles sont citées en commentaire dans
le code et dans les harnais.

## Confidentialité

**Aucune donnée nominative ici.** Le dépôt est public, et 30 000 personnes
réelles sont derrière la base.

Un défaut se décrit par **ce qu'on faisait** et par **la forme de la donnée**,
jamais par qui on regardait : « un mandat à plus de deux cents candidatures »,
« une fiche sans CV depuis 2019 ». Pas de nom, pas d'adresse, pas d'identifiant,
pas d'URL de profil.

⚠ **Il n'existe aucune échappatoire.** Un commentaire de demande de fusion est
tout aussi public que ce fichier, et il échappe en plus à `gitleaks`, qui ne
parcourt que l'historique git. Si un défaut est vraiment incompréhensible sans
l'identifiant, l'identifiant se transmet **hors du dépôt** — et la ligne du
registre décrit la forme.
