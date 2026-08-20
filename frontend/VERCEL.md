# Pourquoi ce `vercel.json` existe

## Le symptôme

Le build réussissait, le déploiement était marqué **Ready**, et **toutes** les
routes de l'application renvoyaient `404: NOT_FOUND` — y compris l'accueil.
Aucune erreur nulle part : ni dans le log de build, ni dans le tableau de bord.

## Le diagnostic, et comment il a été établi

L'hypothèse : Vercel ne servait pas la sortie de Next.js, mais le dossier
`public/` comme un site statique ordinaire. Ce dossier ne contient aucun
`index.html`, d'où un 404 sur chaque route.

Cette hypothèse fait une **prédiction vérifiable** : si elle est vraie, les
fichiers présents dans `public/` doivent, eux, répondre normalement. Test sur le
déploiement :

```
/file.svg      200      /   (accueil)   404
/globe.svg     200      /offres         404
/next.svg      200
/vercel.svg    200
/window.svg    200
/Assets/logos/Pachamama full logo.svg   200
```

Six fichiers sur six répondent, zéro route applicative. La prédiction est
confirmée : **le `Framework Preset` du projet n'était pas « Next.js »**, ou son
`Output Directory` était forcé sur `public`.

## Le correctif

Les réglages de build déclarés dans `vercel.json` **priment sur ceux du tableau
de bord**. Déclarer le framework ici règle le problème depuis le dépôt, et
surtout le rend **reproductible** : un projet recréé plus tard, ou un second
environnement, hérite du bon réglage sans que personne ait à se souvenir d'une
case à cocher.

`outputDirectory: null` neutralise explicitement un éventuel dossier de sortie
forcé côté projet.

## La leçon de méthode

« Build réussi » et « déploiement Ready » ne prouvent pas qu'une application est
servie. Ils prouvent que des fichiers ont été produits et déployés — pas que ce
sont les bons. Le seul contrôle qui tranche est une requête sur une route réelle.

Trois contrôles à faire après chaque changement de configuration :

```bash
U=https://pachamama-os.vercel.app
curl -s -o /dev/null -w 'accueil  %{http_code}\n' $U/
curl -s -o /dev/null -w 'icon     %{http_code}\n' $U/icon.svg
curl -s $U/ | grep -c "Découvrir l"
```

Attendu : `200`, `200`, `1`.
