from flask import Flask, request, jsonify, make_response
from flask import send_from_directory
import csv
from flask_cors import CORS
import os, sqlite3, json, uuid, re
from datetime import datetime, timedelta
import jwt
from werkzeug.security import generate_password_hash, check_password_hash
from openai import OpenAI
import pandas as pd
from sentence_transformers import SentenceTransformer, util
import re
import unidecode

# ------------------- Config -------------------
APP_NAME = "Popflix"
ACCESS_SECRET = os.getenv("ACCESS_SECRET", "change_me_access")
REFRESH_SECRET = os.getenv("REFRESH_SECRET", "change_me_refresh")  # (non utilisé dans cette version)
ACCESS_EXPIRE_MIN = 15
REFRESH_EXPIRE_DAYS = 30

BASE_DIR = os.path.dirname(__file__)
FRONT_DIR = os.path.join(BASE_DIR, "..", "frontend")   # <-- dossier frontend
DATA_DIR  = os.path.join(BASE_DIR, "..", "data")       # <-- dossier data (csv, images)

DB_PATH = os.path.join(DATA_DIR, "app.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

# Servez le frontend directement depuis Flask au même origin:5000
app = Flask(APP_NAME, static_folder=FRONT_DIR, static_url_path="")  # static à la racine
# Autorise le front (et cookies cross-site si besoin)
CORS(app, supports_credentials=True)

# Accueil -> / sert index.html (fichier du dossier frontend)
@app.route("/")
def serve_home():
    return app.send_static_file("index.html")

# Servir tout le contenu du dossier /data (CSV, images, etc.)
@app.route("/data/<path:filename>")
def serve_data(filename):
    return send_from_directory(DATA_DIR, filename)

# (Optionnel, utile pour debug)
@app.get("/health")
def health():
    return jsonify({"ok": True})

# ------------------- DB helpers -------------------
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with db() as con:
        con.execute("""
        CREATE TABLE IF NOT EXISTS users(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        """)
        con.execute("""
        CREATE TABLE IF NOT EXISTS refresh_tokens(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token_hash TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          device_info TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """)
        con.execute("""
        CREATE TABLE IF NOT EXISTS events(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          event_type TEXT NOT NULL,
          event_payload TEXT,
          ip_address TEXT,
          user_agent TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        );
        """)

init_db()

# ------------------- Tokens helpers -------------------
def create_access_token(user_id: int) -> str:
    payload = {
        "userId": user_id,
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_EXPIRE_MIN)
    }
    return jwt.encode(payload, ACCESS_SECRET, algorithm="HS256")

def create_refresh_token() -> str:
    # un gros aléa suffisant
    return f"{uuid.uuid4()}-{uuid.uuid4()}"

def set_refresh_cookie(resp, token, remember=True):
    max_age = (REFRESH_EXPIRE_DAYS if remember else 7) * 24 * 3600
    resp.set_cookie(
        "refresh_token",
        token,
        httponly=True,
        secure=False,      # mets True en prod (HTTPS)
        samesite="Lax",
        max_age=max_age,
        path="/"
    )

def require_auth(fn):
    # petit décorateur pour routes protégées (lit Authorization: Bearer <token>)
    from functools import wraps
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Missing token"}), 401
        token = auth.split(" ", 1)[1]
        try:
            data = jwt.decode(token, ACCESS_SECRET, algorithms=["HS256"])
            request.user_id = int(data["userId"])
        except Exception:
            return jsonify({"error": "Invalid token"}), 401
        return fn(*args, **kwargs)
    return wrapper

# ------------------- Auth routes -------------------
@app.post("/auth/register")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"error": "email & password required"}), 400

    with db() as con:
        cur = con.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cur.fetchone():
            return jsonify({"error": "Email déjà utilisé"}), 400
        con.execute(
            "INSERT INTO users(email, password_hash) VALUES (?, ?)",
            (email, generate_password_hash(password))
        )
        user_id = con.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
    return jsonify({"id": user_id, "email": email})

@app.post("/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    remember = bool(data.get("remember", True))

    with db() as con:
        row = con.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not row or not check_password_hash(row["password_hash"], password):
            return jsonify({"error": "Identifiants invalides"}), 401

        access = create_access_token(row["id"])
        refresh = create_refresh_token()
        # on stocke un HASH du refresh
        refresh_hash = generate_password_hash(refresh)
        expires_at = (datetime.utcnow() + timedelta(days=(REFRESH_EXPIRE_DAYS if remember else 7))).isoformat()
        device = request.headers.get("User-Agent", "unknown")
        con.execute(
            "INSERT INTO refresh_tokens(user_id, token_hash, expires_at, device_info) VALUES (?,?,?,?)",
            (row["id"], refresh_hash, expires_at, device)
        )

    resp = make_response(jsonify({"accessToken": access}))
    set_refresh_cookie(resp, refresh, remember=remember)
    return resp

@app.post("/auth/refresh")
def refresh():
    rt = request.cookies.get("refresh_token")
    if not rt:
        return jsonify({"error": "No refresh cookie"}), 401

    with db() as con:
        now_iso = datetime.utcnow().isoformat()
        tokens = con.execute(
            "SELECT id, user_id, token_hash FROM refresh_tokens WHERE expires_at > ?",
            (now_iso,)
        ).fetchall()

        for t in tokens:
            if check_password_hash(t["token_hash"], rt):
                # rotation de refresh: nouveau refresh + mise à jour du hash
                new_access = create_access_token(t["user_id"])
                new_refresh = create_refresh_token()
                con.execute(
                    "UPDATE refresh_tokens SET token_hash=?, expires_at=? WHERE id=?",
                    (
                        generate_password_hash(new_refresh),
                        (datetime.utcnow() + timedelta(days=REFRESH_EXPIRE_DAYS)).isoformat(),
                        t["id"]
                    )
                )
                resp = make_response(jsonify({"accessToken": new_access}))
                set_refresh_cookie(resp, new_refresh, remember=True)
                return resp

    return jsonify({"error": "Invalid refresh"}), 401

@app.post("/auth/logout")
def logout():
    rt = request.cookies.get("refresh_token")
    with db() as con:
        if rt:
            rows = con.execute("SELECT id, token_hash FROM refresh_tokens").fetchall()
            for r in rows:
                if check_password_hash(r["token_hash"], rt):
                    con.execute("DELETE FROM refresh_tokens WHERE id=?", (r["id"],))
    resp = make_response(jsonify({"ok": True}))
    resp.delete_cookie("refresh_token", path="/")
    return resp

@app.get("/me")
@require_auth
def me():
    with db() as con:
        row = con.execute("SELECT id, email FROM users WHERE id = ?", (request.user_id,)).fetchone()
        if not row:
            return jsonify({"error": "User not found"}), 404
        return jsonify({"id": row["id"], "email": row["email"]})

# ------------------- Events logging -------------------
@app.post("/events")
@require_auth
def log_event():
    data = request.get_json(silent=True) or {}
    ev_type = data.get("type")
    payload = data.get("payload")
    if not ev_type:
        return jsonify({"error": "type required"}), 400

    with db() as con:
        con.execute(
            "INSERT INTO events(user_id, event_type, event_payload, ip_address, user_agent) VALUES (?,?,?,?,?)",
            (
                request.user_id,
                ev_type,
                json.dumps(payload) if payload is not None else None,
                request.remote_addr,
                request.headers.get("User-Agent")
            )
        )
    return jsonify({"ok": True})

# ------------------- Endpoint catalogue -------------------

chatbot_key = "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"

client = OpenAI(
  base_url="https://openrouter.ai/api/v1",
  api_key=chatbot_key,
)

def clean_text(text):
    if pd.isna(text):
        return ""
    text = text.lower()
    text = unidecode.unidecode(text)
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return text

@app.route("/recommend", methods=["POST"])
def recommend():
    # Charger la base
    df = pd.read_csv("data/base_de_donnees/films_series_200_filled.csv")
    
    # Préparer la description
    df["description"] = df["title"] + " " + df["genre"] * 2 + " " + df["synopsis"] * 3
    df["description"] = df["description"].apply(clean_text)
    
    # Créer les embeddings
    model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    embeddings = model.encode(df["description"].tolist(), convert_to_tensor=True)
    
    # Récupérer la liste des films depuis la requête
    films_list = request.json.get("list")
    print(films_list)
    if not films_list:
        return jsonify({"error": "Aucune liste de films fournie"}), 400

    # Trouver les indices des films dans le dataframe
    indices = [df[df["title"] == film].index[0] for film in films_list if film in df["title"].values]

    if not indices:
        return jsonify({"error": "Aucun film de la liste n'a été trouvé"}), 404

    # Calculer la similarité et combiner les scores
    combined_scores = None
    for idx in indices:
        scores = util.cos_sim(embeddings[idx], embeddings)[0]
        if combined_scores is None:
            combined_scores = scores
        else:
            combined_scores += scores  # somme des similarités pour tous les films
    
    # Exclure les films déjà dans la liste
    for idx in indices:
        combined_scores[idx] = -1
    
    # Prendre les top 5 recommandations
    top_idx = combined_scores.argsort(descending=True)[:5]

    return jsonify({'result': df.iloc[top_idx][["title", "genre"]].to_dict(orient='records')}), 200


@app.route("/chat", methods=["POST"])
def chat():
    system_prompt = ""
    if request.json.get("mode") == "detection":
        system_prompt = "Votre rôle est de déterminer si le message de l'utilisateur demande une recommandation d'une œuvre audiovisuelle. Répondez 'oui' si l'utilisateur demande une recommandation d'anime, de film ou de série, et 'non' dans le cas contraire."
    elif request.json.get("mode") == "recommendation":
        result = request.json.get("result")
        system_prompt = f"L'utilisateur a demandé des recommandations audiovisuelles. Voici cinq meilleures correspondances : {result}. Répondez avec deux sélections, en fournissant des informations brèves et exactes sans invention, en moins de 50 mots."
    else:
        system_prompt = "Tu es un assistant virtuel spécialisé dans la recommendation de séries et de films. Your answers should contain maximum 30 words."

    completion = client.chat.completions.create(
        extra_body={"mode": "non-thinking", "function_call": "none"},
        model="qwen/qwen3-235b-a22b:free",
        messages=[
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": request.json.get("message")
            }
        ]
    )
    response = completion.choices[0].message.content
    cleaned = re.sub(r"<think>.*?</think>", "", response, flags=re.DOTALL)
    cleaned = re.sub(r"\n", " ", cleaned)
    return jsonify({'response': cleaned.strip()}), 200

@app.route("/get_event", methods=["GET"])
def get_event():
    # On bascule sur le CSV avec colonnes épisodes
    csv_path = os.path.join(DATA_DIR, "base_de_donnees", "films_series_200_filled_episodes.csv")

    media_id = request.args.get("id")
    if not media_id:
        return jsonify({'error': 'missing id'}), 400

    def parse_int_or_none(v):
        v = (v or "").strip()
        if not v or v.lower() == "nan":
            return None
        try:
            return int(v)
        except ValueError:
            return None

    try:
        with open(csv_path, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('id') == media_id:
                    return jsonify({
                        'id': row.get('id'),
                        'title': row.get('title'),
                        'poster': row.get('poster'),
                        'year': row.get('year'),
                        'type': row.get('type'),
                        'genre': row.get('genre'),
                        'synopsis': row.get('synopsis'),
                        'director': row.get('director'),
                        'actors': row.get('actors'),
                        'number_of_episodes': parse_int_or_none(row.get('number_of_episodes'))
                    }), 200

        return jsonify({'error': f'No entry found for id {media_id}'}), 404

    except FileNotFoundError:
        return jsonify({'error': f'File not found: {csv_path}'}), 500

    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

# ------------------- Metrics: viewing (uniques uniquement) -------------------
@app.get("/metrics/viewing")
def metrics_viewing():
    """
    Agrège les events 'episode_watched' et 'movie_watched' pour calculer :
    - nb de films vus (uniques)
    - nb de séries vues (uniques)
    - nb total d'épisodes vus
    - répartition par genre (films / séries séparés)
    - répartition par type (film vs série)
    """
    from collections import defaultdict
    import re, json as _json

    # Compteurs / agrégats
    series_episodes = defaultdict(int)  # title -> nb épisodes
    series_titles = set()               # séries vues (uniques)
    episodes_total = 0

    movies_titles = set()               # films vus (uniques)

    genre_movies = defaultdict(int)
    genre_series = defaultdict(int)

    type_counts = defaultdict(int)      # 'film' | 'série' -> nb de titres uniques

    def split_genres(val: str):
        if not val:
            return []
        parts = [p.strip() for p in re.split(r"[|,;/]", str(val)) if p.strip()]
        return parts[:6]

    with db() as con:
        rows = con.execute("""
            SELECT event_type, event_payload
            FROM events
            WHERE event_type IN ('episode_watched','movie_watched')
        """).fetchall()

        for r in rows:
            et = r["event_type"]
            try:
                payload = _json.loads(r["event_payload"] or "{}")
            except Exception:
                payload = {}

            if et == "episode_watched":
                title = (payload.get("series_title") or payload.get("title") or "").strip()
                if title:
                    series_episodes[title] += 1
                    series_titles.add(title)
                episodes_total += 1
                for g in split_genres(payload.get("genre") or payload.get("genres")):
                    genre_series[g] += 1

            elif et == "movie_watched":
                title = (payload.get("title") or "").strip()
                if title:
                    movies_titles.add(title)
                for g in split_genres(payload.get("genre") or payload.get("genres")):
                    genre_movies[g] += 1

    # Séries triées par nb d’épisodes
    series_list = [{"title": t, "episodes": n} for t, n in series_episodes.items()]
    series_list.sort(key=lambda x: x["episodes"], reverse=True)

    # Pies genres (films / séries)
    total_g_movies = sum(genre_movies.values()) or 1
    by_genre_movies = [
        {"genre": g, "count": c, "share": round(c / total_g_movies, 4)}
        for g, c in sorted(genre_movies.items(), key=lambda kv: kv[1], reverse=True)
    ]

    total_g_series = sum(genre_series.values()) or 1
    by_genre_series = [
        {"genre": g, "count": c, "share": round(c / total_g_series, 4)}
        for g, c in sorted(genre_series.items(), key=lambda kv: kv[1], reverse=True)
    ]

    # Répartition par type (uniques)
    total_uniques = len(movies_titles) + len(series_titles) or 1
    by_type = [
        {"type": "film",  "count": len(movies_titles),  "share": round(len(movies_titles) / total_uniques, 4)},
        {"type": "série", "count": len(series_titles), "share": round(len(series_titles) / total_uniques, 4)},
    ]

    # Compteurs principaux
    counts = {
        "movies": len(movies_titles),     # nb de films uniques vus
        "series": len(series_titles),     # nb de séries uniques vues
        "series_episodes": episodes_total # nb total d'épisodes vus (tous confondus)
    }

    return jsonify({
        "counts": counts,
        "series": series_list,
        "by_genre_movies": by_genre_movies,
        "by_genre_series": by_genre_series,
        "by_type": by_type
    })


# ------------------- Run -------------------
if __name__ == "__main__":
    # important: avec static_url_path="" le front est servi à la racine
    app.run(debug=True)
