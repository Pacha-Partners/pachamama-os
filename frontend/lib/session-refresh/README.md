# Le middleware de rafraîchissement de session — retiré, et pourquoi

`middleware.reference.ts` est l'ancien `middleware.ts` de la racine. Il a été
retiré du chemin d'exécution le 20/08/2026. Le remettre en place se fait en le
déplaçant à la racine du frontend sous le nom `middleware.ts`.

## Ce qu'il faisait

Il rafraîchissait la session Supabase à chaque navigation, parce qu'un Server
Component ne peut pas écrire de cookie : sans ce passage, un jeton expiré ne
serait jamais renouvelé et l'utilisateur serait déconnecté en pleine session.

## Pourquoi il est retiré

**Il ne servait à rien et il pouvait tout casser.**

Rien, parce que le déploiement public ne porte volontairement aucune clé d'accès
à la base : il n'y a aucune session à rafraîchir.

Tout casser, parce qu'un middleware s'exécute sur **chaque requête** et dans le
**Edge Runtime**, pas en Node. Une exception y ne fait pas tomber une page : elle
fait tomber le site entier, avec un `MIDDLEWARE_INVOCATION_FAILED` en 500 sur
toutes les routes, y compris celles qui n'ont aucun besoin d'authentification.
C'est ce qui s'est produit en production.

J'avais d'abord ajouté deux garde-fous *à l'intérieur* de la fonction — sortie
anticipée si l'environnement n'est pas configuré, et `try/catch` autour du reste.
Vérifiés en local sur un serveur de production sans variables : toutes les routes
répondaient. Et le déploiement continuait de tomber.

L'hypothèse qui me manquait : **l'import de `@supabase/ssr` est au niveau du
module.** S'il échoue à l'initialisation dans le Edge Runtime, il échoue *avant*
que mon garde-fou ne s'exécute. Aucun test local en Node ne pouvait le montrer.

## Quand le remettre, et sous quelle forme

À remettre le jour où l'authentification est réellement branchée. Mais pas tel
quel : **l'import doit devenir dynamique**, à l'intérieur du bloc gardé —

```ts
if (!url || !cle) return NextResponse.next({ request: requete })
const { createServerClient } = await import('@supabase/ssr')
```

de sorte qu'aucun module ne se charge quand la configuration est absente. Et le
`try/catch` reste, pour que le sens sûr de la défaillance soit « visiteur non
identifié » et jamais « site en panne ».

## Ce qui ne change pas

L'autorisation n'a jamais dépendu de ce fichier. Elle vit dans les policies
PostgreSQL : RLS active sans policy, donc refus par défaut. Le retrait du
middleware ne relâche aucun contrôle d'accès — il retire un rafraîchissement de
session inutile en l'état.
