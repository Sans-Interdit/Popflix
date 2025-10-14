"""
Remplit la colonne 'poster' d'un CSV avec de vraies URLs d'affiches via TMDb.

Usage basique :
    python fill_posters_tmdb.py VOTRE_TMDB_API_KEY

Usage avancé :
    python fill_posters_tmdb.py VOTRE_TMDB_API_KEY --csv "C:/chemin/films_series_200_fr.csv" --out "C:/chemin/films_series_200_filled.csv"

Notes :
- Requiert : pandas, requests
- Ajoutez le crédit TMDb : “This product uses the TMDb API but is not endorsed or certified by TMDb.”
"""

import argparse
import os
import sys
import time
import urllib.parse
from typing import Optional, Dict, Any

import pandas as pd
import requests

BASE = "https://api.themoviedb.org/3"
IMG_BASE = "https://image.tmdb.org/t/p/w500"


def search_tmdb(api_key: str, title: str, year: Optional[int], is_tv: bool,
                retries: int = 2, timeout: int = 20) -> Optional[Dict[str, Any]]:
    """
    Cherche le meilleur résultat TMDb pour un titre donné.
    1) tente avec le paramètre d'année (si fourni)
    2) retente sans année si aucun résultat
    """
    kind = "tv" if is_tv else "movie"
    q = urllib.parse.quote(title)

    urls = []
    if year is not None:
        yparam = "first_air_date_year" if is_tv else "year"
        urls.append(f"{BASE}/search/{kind}?api_key={api_key}&query={q}&{yparam}={year}")
    urls.append(f"{BASE}/search/{kind}?api_key={api_key}&query={q}")

    for url in urls:
        attempt = 0
        while attempt <= retries:
            try:
                r = requests.get(url, timeout=timeout)
                r.raise_for_status()
                results = r.json().get("results", [])
                if results:
                    return results[0]
                break  # pas d'erreur réseau mais aucun résultat -> on passe à l’URL suivante
            except requests.RequestException:
                attempt += 1
                if attempt > retries:
                    return None
                time.sleep(0.6)  # petite pause avant retry
    return None


def human_progress(i: int, total: int, title: str, filled: int):
    percent = int((i + 1) * 100 / total) if total else 100
    sys.stdout.write(f"\r[{i+1:>3}/{total}] {percent:>3}% | filled={filled:>3} | {title[:60]}")
    sys.stdout.flush()


def _is_missing(val: Any) -> bool:
    """Retourne True si la valeur ne contient PAS d'URL exploitable."""
    v = str(val).strip().lower() if val is not None else ""
    return (v == "" or v in ("nan", "none", "null", "na"))


def _is_tv(value: Any) -> bool:
    """Détecte 'Série' vs 'Film' de façon tolérante."""
    v = str(value or "").strip().lower()
    return v in ("serie", "série", "tv", "show", "series")


def _to_year(value: Any) -> Optional[int]:
    """Convertit en int sûr, sinon None."""
    try:
        y = int(str(value).strip())
        return y if 1800 <= y <= 2100 else None
    except Exception:
        return None


def main():
    parser = argparse.ArgumentParser(description="Fill 'poster' URLs from TMDb into a CSV.")
    parser.add_argument("api_key", help="Your TMDb API key")
    parser.add_argument("--csv", dest="csv_path", default=None,
                        help="Path to input CSV (default: films_series_200_fr.csv next to this script)")
    parser.add_argument("--out", dest="out_path", default=None,
                        help="Path to output CSV (default: films_series_200_filled.csv next to input)")
    parser.add_argument("--sleep", dest="sleep_s", type=float, default=0.2,
                        help="Pause (seconds) between API calls (default: 0.2)")
    args = parser.parse_args()

    # Chemin CSV par défaut : même dossier que le script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = args.csv_path or os.path.join(script_dir, "films_series_200_fr.csv")

    if not os.path.isfile(csv_path):
        print(f"❌ CSV introuvable : {csv_path}")
        print("Astuce : utilisez --csv pour préciser le chemin du fichier.")
        sys.exit(1)

    # Chemin de sortie par défaut dans le même dossier que le CSV
    out_path = args.out_path or os.path.join(os.path.dirname(csv_path), "films_series_200_filled.csv")

    print(f"📥 Lecture : {csv_path}")
    df = pd.read_csv(csv_path)

    # Contrôles basiques
    for required in ["title", "year", "type", "poster"]:
        if required not in df.columns:
            print(f"❌ Colonne manquante : '{required}'")
            sys.exit(1)

    # --- FIX 1 : neutraliser les NaN au lieu de les transformer en chaîne "nan"
    df["poster"] = df["poster"].fillna("").astype(str)

    # --- Optionnel : nettoyer d’éventuels "nan"/"null"/"none" déjà présents
    df["poster"] = df["poster"].apply(lambda s: "" if _is_missing(s) else str(s).strip())

    total = len(df)
    filled = 0

    print(f"🔎 Démarrage : {total} entrées à traiter")
    for i, row in df.iterrows():
        try:
            title = str(row["title"])
            year = _to_year(row["year"])
            is_tv = _is_tv(row["type"])

            # si déjà rempli avec une vraie URL, on saute
            if not _is_missing(row["poster"]):
                human_progress(i, total, title, filled)
                continue

            hit = search_tmdb(args.api_key, title, year, is_tv)
            if hit and hit.get("poster_path"):
                df.at[i, "poster"] = IMG_BASE + hit["poster_path"]
                filled += 1

            human_progress(i, total, title, filled)
            time.sleep(args.sleep_s)

        except Exception as e:
            print(f"\n⚠️  Erreur sur «{row.get('title', '???')}»: {e}")

    # Sauvegarde
    df.to_csv(out_path, index=False, encoding="utf-8")
    print(f"\n✅ Terminé. Affiches ajoutées pour {filled}/{total} lignes.")
    print(f"💾 Fichier écrit : {out_path}")
    print("ℹ️ Crédit TMDb requis : “This product uses the TMDb API but is not endorsed or certified by TMDb.”")


if __name__ == "__main__":
    main()
