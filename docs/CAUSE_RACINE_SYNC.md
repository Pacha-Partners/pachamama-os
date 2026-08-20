# La cause racine des pertes de synchronisation

> Établie le 20/08/2026, en confrontant le code de `n8n_sync_type.js` aux écarts
> mesurés entre Bubble et le miroir. Le diagnostic précédent
> (`PLAN_REPARATION_SYNC.md`) avait classé ce mécanisme **« INCERTAIN »** sous le
> nom de BUG A5. Les données le confirment.

---

## Le symptôme

| type | perdus | fantômes |
|---|---|---|
| `note` | 416 | 5 540 |
| `process` | **465** | 3 |
| `entreprise` | 0 | 620 |
| `candidat` | 35 | 0 |
| `mandat` | 1 | 19 |
| `user`, `experience`, `job_actuel`, `produit` | **0** | **0** |

Deux faits rendent ce tableau lisible :

1. **La synchronisation tourne et se déclare saine.** Tous les types sont en
   `last_run_status = 'ok'`, watermarks à 09 h 00 le jour même. Aucune erreur.
2. **Les perdus sont récents.** Les 35 candidats perdus datent tous d'août ; les
   465 process de juillet (270) et août (195). Ce ne sont pas des cicatrices
   anciennes : **la perte est en cours**.

Et le motif désigne le coupable : les types qui perdent sont ceux qu'on **écrit
souvent**. Les types statiques ne perdent rien.

---

## Le mécanisme

La lecture incrémentale est construite ainsi :

```js
constraints = [
  { key: 'Modified Date', constraint_type: 'greater than', value: watermark },
  { key: 'Modified Date', constraint_type: 'less than',    value: T_snapshot },
]
sort_field: 'Modified Date', sort_order: 'ascending'
cursor: 0, 100, 200, …          // pagination par DÉCALAGE
```

Trois choix qui, pris séparément, sont raisonnables. Ensemble, ils perdent des
enregistrements :

1. on **filtre** sur `Modified Date`,
2. on **trie** sur `Modified Date`,
3. on **pagine par décalage** — « donne-moi les 100 suivants à partir du rang N ».

Or l'application continue de tourner pendant la pagination.

### Ce qui se passe, pas à pas

| | |
|---|---|
| Le run démarre | `T_snapshot` est figé. La fenêtre est `(watermark, T_snapshot)` |
| Page 1, rang 0 → 99 | on lit 100 enregistrements triés par date de modification |
| **Pendant ce temps** | un recruteur modifie une fiche qui se trouvait au rang 150 |
| Conséquence | sa date de modification devient « maintenant », donc **supérieure à `T_snapshot`** : elle **sort de la fenêtre** |
| Effet de bord | tous les enregistrements après elle **remontent d'un rang** |
| Page 2, rang 100 → 199 | on saute l'enregistrement qui occupait désormais le rang 99 |

**Et cet enregistrement est perdu pour toujours.** Sa date de modification reste
inférieure au watermark final : au run suivant, la contrainte
`greater than watermark` ne le verra jamais.

Aucune exception n'est levée. Aucun échec d'insertion. Le run se termine en
`ok`. **C'est une perte parfaitement silencieuse.**

### Pourquoi la borne haute aggrave au lieu de protéger

`less than T_snapshot` a été ajoutée pour obtenir un instantané cohérent. C'est
elle qui fait **disparaître** l'enregistrement modifié au lieu de le déplacer en
fin de liste. Sans elle, la fiche modifiée irait à la fin et serait simplement
**relue** — un doublon inoffensif, puisque l'écriture est idempotente.

La borne censée garantir la cohérence est précisément ce qui casse l'exhaustivité.

---

## Pourquoi les correctifs précédents n'ont pas suffi

Trois correctifs réels ont été appliqués et sont bien présents dans le code
déployé : le watermark n'avance plus sur exception (A0), il recule d'une
milliseconde (A1), et les 429/503 sont réessayés (D5).

Ils traitent tous **la perte par échec**. Or ce mécanisme-ci ne produit aucun
échec : il perd **par décalage**, en silence, pendant que tout se passe bien.

---

## Le correctif

**Remplacer la pagination par décalage par une pagination par valeur.**

Au lieu de « donne-moi les 100 suivants à partir du rang N », on demande
« donne-moi les 100 suivants **après cette date** » :

```js
// à chaque page, on repart du rang 0 avec une borne basse qui avance
watermarkPage = derniereDateLue      // et non cursor += 100
constraints = [{ key: 'Modified Date', constraint_type: 'greater than',
                 value: watermarkPage }]
```

Un ensemble qui bouge ne peut plus faire sauter de ligne : on reprend depuis une
**valeur**, pas depuis une **position**.

**Et retirer la borne haute `T_snapshot`.** Un enregistrement modifié pendant le
run est alors relu au lieu de disparaître. L'écriture étant idempotente, un
doublon ne coûte rien — une disparition coûte un enregistrement.

**Reste une subtilité** : plusieurs enregistrements peuvent porter exactement la
même date à la milliseconde. Avec une borne stricte `greater than`, les ex æquo
au-delà du premier seraient sautés. Il faut donc soit un départage stable
(l'identifiant), soit relire la dernière milliseconde à chaque page et laisser
l'idempotence absorber les doublons.

---

## L'autre problème, distinct : les suppressions

Les 6 182 fantômes ne relèvent pas du même mécanisme, et **aucun correctif de
pagination ne les traitera**.

Une synchronisation fondée sur « ce qui a changé depuis X » **ne peut pas voir
une suppression** : un enregistrement supprimé n'a plus de date de modification
à déclarer. C'est structurel, pas accidentel.

La seule parade est une **réconciliation périodique par différence d'ensembles
d'identifiants** — exactement le contrôle qui a produit ce tableau. Ce n'est pas
un rattrapage ponctuel : c'est le complément permanent de l'incrémental.

**Vérifié** : sur 30 fantômes `entreprise`, 19 `mandat`, 3 `process` et 20
`note` sondés par appel direct, **tous** répondent « Missing object » — ils sont
réellement supprimés dans Bubble. Le miroir a tort, pas l'API. Aucun angle mort.

---

## Ce que ça implique pour le pivot

Le pivot doit lire le miroir. Cette architecture est la bonne — elle rend le
moteur d'inclusion transactionnel et natif à PostgreSQL — mais elle a une
condition : **le miroir doit être exact**.

Il ne l'est pas aujourd'hui, et il ne le sera pas durablement sans ces deux
correctifs. Les poser avant de brancher le pivot est ce qui évite de construire
un rattrapage permanent autour d'un défaut qu'on n'a pas corrigé.
