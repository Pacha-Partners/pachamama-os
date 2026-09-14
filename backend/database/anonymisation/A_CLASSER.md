# Tables à faire entrer dans la classification quand elles existeront

> La classification couvre les 785 colonnes **existantes** de `public` et
> `pivot`. Les tables décidées mais non encore créées n'y sont pas, par
> construction — et `verifier_classification.py` ne peut pas signaler l'absence
> d'une table qui n'existe pas.
>
> C'est donc ici qu'il faut regarder avant de recharger le dev après une
> migration qui ajoute des tables.

## `app.journal_ecriture` — le plus important

Décidé le 26/08 (voir `docs/decisions/0003-modele-donnees-application.md`).
Il porte `valeur_avant` et `valeur_apres` : **des noms, des salaires, des
appréciations écrites sur des personnes nommées**.

Chargé tel quel dans le dev, il y déverserait l'historique en clair des
modifications faites sur trente mille personnes — alors que les tables dont il
retrace les changements, elles, sont anonymisées. Le contournement le plus sûr
est probablement de **ne pas le charger du tout**, comme les six tables de
tenue de synchro : sa valeur pour développer un écran est faible, son risque
élevé.

À trancher au moment de sa création, pas après.

## Les autres tables `app` décidées

`compte` et `acces` portent des identifiants d'authentification et des
rattachements ; `fiche_talent` porte l'identité déclarée et ses colonnes
`_origine` ; `demande_rgpd`, `consentement` et `audit_admin` portent par nature
des données nominatives.

Aucune n'existe encore. Chacune devra être classée à sa création, et le contrôle
arithmétique de `verifier_classification.py` s'en chargera ensuite — mais
seulement une fois la table présente au schéma.

## Le réflexe à garder

Après toute migration qui ajoute une table, relancer
`verifier_classification.py`. Il échouera sur `TABLE NON CLASSÉE (serait chargée
telle quelle)`. C'est le comportement voulu : le contrôle refuse de laisser
passer une table dont personne n'a décidé le traitement.
