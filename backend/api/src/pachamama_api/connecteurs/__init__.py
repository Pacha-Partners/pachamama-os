"""Connecteurs d'ingestion : une source -> le pivot.

Ces modules font entrer la donnée dans `pivot`. Ils sont volontairement
SEPARES de l'API : celle-ci sert des lectures, l'ingestion est un autre metier
et un autre rythme. Mais ils vivent dans le meme paquet pour deux raisons
concretes : ils partagent la configuration (`config.py`, donc plus aucun
fichier `.env` reparse a la main), et l'API pourra les declencher plus tard
sans duplication.

Chacun s'execute aussi seul, aujourd'hui :

    python -m pachamama_api.connecteurs.app_pivot            # simulation
    python -m pachamama_api.connecteurs.app_pivot --appliquer

Regle de non-divergence
-----------------------
Le noeud n8n `Ingest_app` est un PORTAGE TEMPORAIRE de `app_pivot` en
JavaScript, imposé par n8n Cloud Starter (pas de variables d'environnement,
5 minutes par execution). La version Python de ce paquet est la version de
REFERENCE. Toute correction se fait ici d'abord, puis se reporte dans le
noeud — jamais l'inverse. Le noeud disparaitra quand l'API sera deployee et
pourra declencher le connecteur elle-meme.
"""
