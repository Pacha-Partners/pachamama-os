#!/usr/bin/env python3
"""
Lève l'angle mort de l'API sur le type `candidat`.

POURQUOI CE CONTRÔLE
Sur le type `mandat`, l'API n'exposait que 498 enregistrements sur ~633 : environ
un sur cinq restait invisible au jeton, masqué par une règle de confidentialité.
Un GET direct sur ces identifiants renvoyait 404. La vérification équivalente sur
`candidat` a été reportée en tâche 4 et jamais faite.

L'enjeu : si le même trou existe, le pivot a été bâti sur une vue PARTIELLE de
l'app, et toute synchronisation le reproduirait à chaque run, en silence.

LA MÉTHODE — croiser les références indirectes
On ne peut pas demander à l'API ce qu'elle ne montre pas. On passe donc par les
types qui CITENT un candidat (`process`, `job_actuel`, `experience`). Un
identifiant cité par eux mais absent de la liste `candidat` est soit un
enregistrement supprimé, soit un enregistrement caché — et un GET direct
distingue les deux :
  · « Missing object of type X »  → réellement supprimé
  · autre chose / 200             → exposé au GET mais absent de la LISTE = caché

PAGINATION — les règles payées par les incidents du projet
On lit le total exact AVANT de commencer, et on échoue bruyamment si on ne
l'atteint pas. Une condition d'arrêt confiante (« page incomplète, on sort ») a
déjà fait écrire 13 073 enregistrements au lieu de 19 381 sans lever d'erreur.
"""
import json, sys, time, urllib.request, urllib.parse, urllib.error

env = {}
for line in open('.env'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1); env[k.strip()] = v.strip().strip('"\'')
ROOT, TOK = env['BUBBLE_API_ROOT'].rstrip('/'), env['BUBBLE_TOKEN']

def appel(url, essais=3):
    for i in range(essais):
        try:
            req = urllib.request.Request(url, headers={'Authorization': f'Bearer {TOK}'})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and i < essais - 1:
                time.sleep(2 ** i); continue
            raise
        except Exception:
            if i < essais - 1:
                time.sleep(2 ** i); continue
            raise

def total(typ):
    d = appel(f"{ROOT}/{typ}?limit=1")['response']
    return d.get('count', 0) + d.get('remaining', 0)

def scanner(typ, champs):
    """Scan complet. Échoue bruyamment si le total lu diffère du total annoncé."""
    attendu = total(typ)
    print(f"  {typ} : {attendu} annoncés…", end='', flush=True)
    lignes, curseur = [], 0
    while True:
        q = urllib.parse.urlencode({'limit': 100, 'cursor': curseur})
        d = appel(f"{ROOT}/{typ}?{q}")['response']
        lot = d.get('results', [])
        if not lot:
            break
        for r in lot:
            lignes.append({c: r.get(c) for c in champs} | {'_id': r.get('_id')})
        curseur += len(lot)
        if d.get('remaining', 0) <= 0:
            break
    if len(lignes) != attendu:
        sys.exit(f"\n  ❌ ARRÊT : {len(lignes)} lus pour {attendu} annoncés. "
                 f"Écart de {attendu - len(lignes)} — on ne construit rien sur un scan incomplet.")
    print(f" {len(lignes)} lus ✅")
    return lignes

print("=== 1. Les candidats VISIBLES dans la liste ===")
visibles = {r['_id'] for r in scanner('candidat', [])}

print("\n=== 2. Les candidats CITÉS par d'autres types ===")
cites = {}
for typ, champ in [('process', 'Candidat'), ('job_actuel', 'Candidat'), ('experience', 'Candidat')]:
    for r in scanner(typ, [champ]):
        cid = r.get(champ)
        if cid:
            cites.setdefault(cid, set()).add(typ)

print(f"\n  identifiants distincts cités : {len(cites)}")

print("\n=== 3. Le croisement ===")
absents = sorted(set(cites) - visibles)
print(f"  visibles dans la liste       : {len(visibles)}")
print(f"  cités par d'autres types     : {len(cites)}")
print(f"  cités mais ABSENTS de la liste : {len(absents)}")

if not absents:
    print("\n  ✅ AUCUN ANGLE MORT. Tout candidat cité est visible dans la liste.")
    sys.exit(0)

print(f"\n=== 4. Supprimés, ou cachés ? (sonde sur {min(len(absents), 25)}) ===")
supprimes = caches = 0
for cid in absents[:25]:
    try:
        appel(f"{ROOT}/candidat/{cid}")
        caches += 1
        print(f"    🔴 CACHÉ    {cid}  (GET 200, absent de la liste) — cité par {','.join(cites[cid])}")
    except urllib.error.HTTPError as e:
        corps = e.read().decode('utf8', 'replace')[:120]
        if 'Missing object' in corps or e.code == 404:
            supprimes += 1
        else:
            caches += 1
            print(f"    🔴 SUSPECT  {cid}  HTTP {e.code} — {corps[:70]}")
print(f"\n  supprimés (normal) : {supprimes}   cachés (anomalie) : {caches}")
if caches:
    print("\n  ⚠️ ANGLE MORT CONFIRMÉ — le pivot repose sur une vue partielle de l'app.")
