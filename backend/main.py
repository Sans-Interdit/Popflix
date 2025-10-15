from flask import Flask, request, jsonify, make_response
from flask import send_from_directory
import csv
from flask_cors import CORS
import os, sqlite3, json, uuid
from datetime import datetime, timedelta
import jwt
from werkzeug.security import generate_password_hash, check_password_hash

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
@app.route("/get_event", methods=["GET"])
def get_event():
    csvUrl = "data/base_de_donnees/films_series_200_filled_episodes.csv"

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

# ------------------- Metrics / Analytics (read-only) -------------------
@app.get("/metrics/summary")
def metrics_summary():
    """
    Résumé chiffré pour la page d'accueil.
    Renvoie:
    - total_users
    - events_total
    - events_today
    - active_users_7d (users distincts ayant fait au moins 1 event sur 7 jours)
    - events_by_type (top 10)
    - events_by_day (les 7 derniers jours)
    """
    with db() as con:
        # Total users
        total_users = con.execute("SELECT COUNT(*) FROM users;").fetchone()[0]

        # Total events
        events_total = con.execute("SELECT COUNT(*) FROM events;").fetchone()[0]

        # Events aujourd'hui (UTC selon CURRENT_TIMESTAMP de SQLite)
        events_today = con.execute("""
            SELECT COUNT(*) FROM events
            WHERE date(created_at) = date('now')
        """).fetchone()[0]

        # Users actifs 7j (ignorer user_id NULL)
        active_users_7d = con.execute("""
            SELECT COUNT(DISTINCT user_id) FROM events
            WHERE user_id IS NOT NULL
              AND created_at >= datetime('now','-7 days')
        """).fetchone()[0]

        # Répartition par type d'event
        events_by_type = [
            {"event_type": r[0], "count": r[1]}
            for r in con.execute("""
                SELECT event_type, COUNT(*) as n
                FROM events
                GROUP BY event_type
                ORDER BY n DESC
                LIMIT 10
            """).fetchall()
        ]

        # Série par jour (7 derniers jours, incluant le jour courant si présent)
        events_by_day = [
            {"date": r[0], "count": r[1]}
            for r in con.execute("""
                SELECT strftime('%Y-%m-%d', created_at) AS d, COUNT(*) AS n
                FROM events
                WHERE created_at >= date('now','-6 days')
                GROUP BY d
                ORDER BY d
            """).fetchall()
        ]

    return jsonify({
        "total_users": total_users,
        "events_total": events_total,
        "events_today": events_today,
        "active_users_7d": active_users_7d,
        "events_by_type": events_by_type,
        "events_by_day": events_by_day
    })

# ------------------- Run -------------------
if __name__ == "__main__":
    # important: avec static_url_path="" le front est servi à la racine
    app.run(debug=True)
