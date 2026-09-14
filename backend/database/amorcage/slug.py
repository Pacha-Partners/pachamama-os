"""Slugification des libellés Bubble vers des codes ASCII stables.

Le code produit ici est FIGÉ UNE FOIS POUR TOUTES : il devient la clé
métier de ref.*, et le recalculer après mise en production casserait
toutes les références. C'est pourquoi chaque correspondance est écrite
dans ref.correspondance, qui en est la preuve d'audit.
"""
import re
import unicodedata
from typing import Optional, Set, Tuple

# Les emoji vivent dans une colonne à part : le code ne doit jamais en porter.
_EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\u2300-\u23FF\u2600-\u27BF\u2B00-\u2BFF\uFE00-\uFE0F\u200D\u2190-\u21FF]+"
)


def separer_emoji(valeur: str) -> Tuple[Optional[str], str]:
    """Rend (emoji, libellé nettoyé). Le miroir préfixe massivement d'emoji."""
    brut = (valeur or "").strip()
    trouves = _EMOJI.findall(brut)
    emoji = "".join(trouves).strip() or None
    libelle = _EMOJI.sub("", brut).strip()
    # Bubble laisse traîner des séparateurs une fois l'emoji retiré.
    libelle = libelle.strip(" -–—:·")
    return emoji, libelle


def slug(valeur: str) -> str:
    """Code ASCII en snake_case. Déterministe, sans accent ni emoji."""
    _, libelle = separer_emoji(valeur)
    s = unicodedata.normalize("NFKD", libelle)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("’", "'").replace("&", " et ")
    # Les symboles porteurs de sens DOIVENT être translittérés avant d'être
    # écrasés : sans cela « C# » et « C++ » se réduisent tous deux à « c »,
    # collision mesurée sur ref_expertise le 28/08/2026.
    s = s.replace("++", " plus plus").replace("#", " sharp")
    s = re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_").lower()
    s = re.sub(r"_+", "_", s)
    return s


def slug_unique(valeur: str, deja: Set[str]) -> str:
    """Garantit l'unicité en suffixant, plutôt qu'en écrasant silencieusement."""
    base = slug(valeur) or "valeur"
    if base not in deja:
        deja.add(base)
        return base
    n = 2
    while f"{base}_{n}" in deja:
        n += 1
    deja.add(f"{base}_{n}")
    return f"{base}_{n}"
