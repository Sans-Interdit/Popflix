# -*- coding: utf-8 -*-
"""
Remplit/complète les colonnes poster, director, actors, synopsis_short, synopsis_long via TMDb.

Usage :
    python fill_details_tmdb.py VOTRE_TMDB_API_KEY \
        --csv "chemin/vers/films_series_200_fr.csv" \
        --out "chemin/vers/films_series_200_filled.csv"

Dépendances :
    pip install pandas requests

⚠️ Crédit TMDb requis et visible sur le site :
“This product uses the TMDb API but is not endorsed or certified by TMDb.”
"""

import argparse
import csv
import os
import sys
import time
import urllib.parse
import re
from typing import Optional, Dict, Any, List

import pandas as pd
import requests

# =========================
# Constantes TMDb
# =========================
BASE = "https://api.themoviedb.org/3"
IMG_BASE = "https://image.tmdb.org/t/p/w500"

# =========================
# Utilitaires de validation
# =========================
def _is_missing(val: Any) -> bool:
    v = str(val).strip().lower() if val is not None else ""
    return (v == "" or v in ("nan", "none", "null", "na"))

def _is_tv(value: Any) -> bool:
    v = str(value or "").strip().lower()
    return v in ("serie", "série", "tv", "show", "series")

def _to_year(value: Any) -> Optional[int]:
    try:
        y = int(str(value).strip())
        return y if 1800 <= y <= 2100 else None
    except Exception:
        return None

# =========================
# Recherches TMDb
# =========================
def search_tmdb(api_key: str, title: str, year: Optional[int], is_tv: bool,
                retries: int = 2, timeout: int = 20, language: str = "fr-FR") -> Optional[Dict[str, Any]]:
    """
    Cherche le meilleur résultat dans /search/movie ou /search/tv.
    1) avec année si fournie, 2) sans année sinon.
    """
    if not title:
        return None

    kind = "tv" if is_tv else "movie"
    q = urllib.parse.quote(title)

    urls = []
    if year is not None:
        yparam = "first_air_date_year" if is_tv else "year"
        urls.append(
            f"{BASE}/search/{kind}?api_key={api_key}&query={q}&{yparam}={year}"
            f"&language={language}&include_adult=false"
        )
    urls.append(f"{BASE}/search/{kind}?api_key={api_key}&query={q}&language={language}&include_adult=false")

    for url in urls:
        attempt = 0
        while attempt <= retries:
            try:
                r = requests.get(url, timeout=timeout)
                r.raise_for_status()
                results = r.json().get("results", [])
                if results:
                    return results[0]
                break  # pas d'erreur, mais 0 résultat -> on tente l'URL suivante
            except requests.RequestException:
                attempt += 1
                if attempt > retries:
                    return None
                time.sleep(0.6)  # petit backoff
    return None

def get_tmdb_details(api_key: str, tmdb_id: int, is_tv: bool,
                     language_primary: str = "fr-FR", language_fallback: str = "en-US",
                     timeout: int = 20) -> Dict[str, Any]:
    """
    Récupère overview (FR avec fallback EN), poster_path, credits (cast+crew), created_by (séries).
    Retourne: { poster_path, overview, cast: [noms], directors: [noms] }
    """
    kind = "tv" if is_tv else "movie"

    def fetch(lang):
        url = f"{BASE}/{kind}/{tmdb_id}?api_key={api_key}&language={lang}&append_to_response=credits"
        r = requests.get(url, timeout=timeout)
        r.raise_for_status()
        return r.json()

    data = {}
    try:
        data = fetch(language_primary)
    except requests.RequestException:
        data = {}

    # Overview FR (fallback EN si vide)
    overview = (data.get("overview") or "").strip()
    if not overview and language_fallback:
        try:
            data_en = fetch(language_fallback)
            overview = (data_en.get("overview") or "").strip() or overview
            if "credits" not in data and "credits" in data_en:
                data["credits"] = data_en["credits"]
        except requests.RequestException:
            pass

    # Poster
    poster_path = data.get("poster_path")

    # Cast (top 5 par "order")
    cast: List[str] = []
    try:
        cast_list = (data.get("credits") or {}).get("cast") or []
        cast = [c.get("name") for c in sorted(cast_list, key=lambda x: x.get("order", 9999)) if c.get("name")]
        cast = cast[:5]
    except Exception:
        cast = []

    # Directors
    directors: List[str] = []
    crew = (data.get("credits") or {}).get("crew") or []
    if not is_tv:
        directors = [m.get("name") for m in crew if (m.get("job") == "Director" and m.get("name"))]
    else:
        created = data.get("created_by") or []
        directors = [c.get("name") for c in created if c.get("name")]
        if not directors:
            directors = [m.get("name") for m in crew if (m.get("job") in ("Executive Producer", "Director") and m.get("name"))]
        # dédoublonner
        directors = list(dict.fromkeys(directors))

    return {
        "poster_path": poster_path,
        "overview": overview,
        "cast": cast,
        "directors": directors
    }

# =========================
# Texte
# =========================
def make_short_synopsis(text: str, max_chars: int = 220) -> str:
    t = (text or "").strip()
    if not t:
        return ""
    # première phrase si assez courte, sinon tronque proprement
    sentences = re.split(r'(?<=[.!?])\s+', t)
    if sentences and len(sentences[0]) <= max_chars:
        return sentences[0]
    if len(t) <= max_chars:
        return t
    cut = t[:max_chars].rsplit(" ", 1)[0]
    return cut + "…"

# =========================
# Affichage progression
# =========================
def human_progress(i: int, total: int, title: str, filled: int):
    percent = int((i + 1) * 100 / total) if total else 100
    sys.stdout.write(f"\r[{i+1:>3}/{total}] {percent:>3}% | ok={filled:>3} | {title[:60]}")
    sys.stdout.flush()

# =========================
# Script principal
# =========================
def main():
    parser = argparse.ArgumentParser(description="Complète poster/director/actors/synopsis_* via TMDb.")
    parser.add_argument("api_key", help="Votre clé TMDb")
    parser.add_argument("--csv", dest="csv_path", default=None,
                        help="Chemin du CSV d'entrée (défaut: films_series_200_fr.csv à côté du script)")
    parser.add_argument("--out", dest="out_path", default=None,
                        help="Chemin du CSV de sortie (défaut: films_series_200_filled.csv à côté de l'entrée)")
    parser.add_argument("--sleep", dest="sleep_s", type=float, default=0.25,
                        help="Pause (secondes) entre appels API (défaut: 0.25)")
    parser.add_argument("--print-sample", action="store_true",
                        help="Affiche un échantillon des colonnes clés avant l'export")
    args = parser.parse_args()

    # Localisation des fichiers
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = args.csv_path or os.path.join(script_dir, "films_series_200_fr.csv")
    if not os.path.isfile(csv_path):
        print(f"❌ CSV introuvable : {csv_path}")
        print("Astuce : utilisez --csv pour préciser le chemin du fichier.")
        sys.exit(1)
    out_path = args.out_path or os.path.join(os.path.dirname(csv_path), "films_series_200_filled.csv")

    print(f"📥 Lecture : {csv_path}")
    df = pd.read_csv(csv_path)

    # Colonnes minimales existantes
    for required in ["title", "year", "type", "poster"]:
        if required not in df.columns:
            print(f"❌ Colonne manquante : '{required}'")
            sys.exit(1)

    # Colonnes ajoutées si absentes
    for col in ["director", "actors", "synopsis_short", "synopsis_long"]:
        if col not in df.columns:
            df[col] = ""

    # Nettoyage poster
    df["poster"] = df["poster"].fillna("").astype(str)
    df["poster"] = df["poster"].apply(lambda s: "" if _is_missing(s) else str(s).strip())

    total = len(df)
    filled = 0
    print(f"🔎 Démarrage : {total} entrées à traiter")

    # Parcours des lignes
    for i, row in df.iterrows():
        try:
            title = str(row["title"]).strip()
            year = _to_year(row["year"])
            is_tv = _is_tv(row["type"])

            # Recherche primaire
            hit = search_tmdb(args.api_key, title, year, is_tv)
            if not hit:
                human_progress(i, total, title, filled)
                time.sleep(args.sleep_s)
                continue

            tmdb_id = hit.get("id")
            poster_path = hit.get("poster_path")

            # Poster
            if _is_missing(row["poster"]) and poster_path:
                df.at[i, "poster"] = IMG_BASE + poster_path

            # Détails
            if tmdb_id:
                details = get_tmdb_details(args.api_key, tmdb_id, is_tv)

                if details.get("poster_path") and _is_missing(df.at[i, "poster"]):
                    df.at[i, "poster"] = IMG_BASE + details["poster_path"]

                # Réalisateurs
                if _is_missing(row.get("director", "")) and details.get("directors"):
                    df.at[i, "director"] = ", ".join(details["directors"])

                # Acteurs (séparateur point médian pour éviter ambiguïté CSV)
                if _is_missing(row.get("actors", "")) and details.get("cast"):
                    df.at[i, "actors"] = " · ".join(details["cast"])

                # Synopsis long (priorité au synopsis existant si présent)
                if _is_missing(row.get("synopsis_long", "")):
                    base_long = str(row.get("synopsis", "")).strip() or details.get("overview") or ""
                    df.at[i, "synopsis_long"] = base_long

                # Synopsis court
                if _is_missing(row.get("synopsis_short", "")):
                    df.at[i, "synopsis_short"] = make_short_synopsis(df.at[i, "synopsis_long"])

                filled += 1

            human_progress(i, total, title, filled)
            time.sleep(args.sleep_s)

        except Exception as e:
            print(f"\n⚠️  Erreur sur «{row.get('title', '???')}»: {e}")

    # (Optionnel) Affiche un petit échantillon pour vérif rapide
    if args.print_sample:
        print("\n--- Échantillon ---")
        cols = [c for c in ["title","director","actors","synopsis_short","synopsis_long"] if c in df.columns]
        sample = df.head(3)[cols]
        for _, r in sample.iterrows():
            print(f"Title: {r.get('title','')}")
            print(f"Director: {r.get('director','')}")
            print(f"Actors: {str(r.get('actors',''))[:120]}")
            print(f"Short: {str(r.get('synopsis_short',''))[:120]!r}")
            print(f"Long:  {str(r.get('synopsis_long',''))[:120]!r}")
            print("-----")

    # Export CSV : TOUT QUOTER -> plus de colonnes décalées
    df.to_csv(
        out_path,
        index=False,
        encoding="utf-8",
        quoting=csv.QUOTE_ALL,
        lineterminator="\n"
    )

    print(f"\n✅ Terminé. Détails ajoutés/complétés pour {filled}/{total} lignes.")
    print(f"💾 Fichier écrit : {out_path}")
    print("ℹ️ Crédit TMDb requis : “This product uses the TMDb API but is not endorsed or certified by TMDb.”")

# =========================
# Entrée
# =========================
if __name__ == "__main__":
    main()
