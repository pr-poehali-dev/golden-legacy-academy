"""
Авторизация пользователей Академии Золотое Наследие.
action=register, action=login, action=logout, action=profile (через query param ?action=...)
"""
import json
import os
import hashlib
import secrets
import psycopg2
from psycopg2.extras import RealDictCursor

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Token",
    "Content-Type": "application/json",
}

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p86624112_golden_legacy_academ")

STATUSES = {
    0: "Ученик",
    1: "Наставник I ступени",
    2: "Наставник II ступени",
    3: "Наставник III ступени",
    4: "Наставник IV ступени",
    5: "Мастер-наставник",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def ok(data: dict, status: int = 200):
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps(data, ensure_ascii=False, default=str)}


def err(message: str, status: int = 400):
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps({"error": message}, ensure_ascii=False)}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            return err("Неверный формат запроса")

    headers = event.get("headers") or {}
    token = headers.get("X-Session-Token") or headers.get("x-session-token")

    # POST ?action=register
    if method == "POST" and action == "register":
        name = (body.get("name") or "").strip()
        email = (body.get("email") or "").strip().lower()
        password = body.get("password") or ""

        if not name or not email or not password:
            return err("Заполните все поля")
        if len(password) < 6:
            return err("Пароль должен быть не менее 6 символов")
        if "@" not in email:
            return err("Неверный формат email")

        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email = %s", (email,))
        if cur.fetchone():
            cur.close(); conn.close()
            return err("Пользователь с таким email уже существует")

        pw_hash = hash_password(password)
        cur.execute(
            f"INSERT INTO {SCHEMA}.users (name, email, password_hash) VALUES (%s, %s, %s) RETURNING id, name, email, status, level, created_at",
            (name, email, pw_hash)
        )
        user = dict(cur.fetchone())

        new_token = secrets.token_hex(32)
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)",
            (user["id"], new_token)
        )
        conn.commit()
        cur.close(); conn.close()

        user["status"] = STATUSES.get(user["level"], "Ученик")
        return ok({"token": new_token, "user": user}, 201)

    # POST ?action=login
    if method == "POST" and action == "login":
        email = (body.get("email") or "").strip().lower()
        password = body.get("password") or ""

        if not email or not password:
            return err("Введите email и пароль")

        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            f"SELECT id, name, email, status, level, created_at FROM {SCHEMA}.users WHERE email = %s AND password_hash = %s",
            (email, hash_password(password))
        )
        user = cur.fetchone()
        if not user:
            cur.close(); conn.close()
            return err("Неверный email или пароль", 401)

        user = dict(user)
        new_token = secrets.token_hex(32)
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)",
            (user["id"], new_token)
        )
        conn.commit()
        cur.close(); conn.close()

        user["status"] = STATUSES.get(user["level"], "Ученик")
        return ok({"token": new_token, "user": user})

    # POST ?action=logout
    if method == "POST" and action == "logout":
        if not token:
            return ok({"message": "Выход выполнен"})
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE token = %s", (token,))
        conn.commit()
        cur.close(); conn.close()
        return ok({"message": "Выход выполнен"})

    # GET ?action=profile
    if method == "GET" and action == "profile":
        if not token:
            return err("Требуется авторизация", 401)

        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            f"""SELECT u.id, u.name, u.email, u.status, u.level, u.is_admin, u.created_at
                FROM {SCHEMA}.users u
                JOIN {SCHEMA}.sessions s ON s.user_id = u.id
                WHERE s.token = %s AND s.expires_at > NOW()""",
            (token,)
        )
        user = cur.fetchone()
        if not user:
            cur.close(); conn.close()
            return err("Сессия истекла, войдите снова", 401)

        user = dict(user)
        user_id = user["id"]
        user["status"] = STATUSES.get(user["level"], "Ученик")

        # Прогресс по площадкам
        cur.execute(
            f"SELECT ground_id, current_module, total_modules, percent, status, started_at, completed_at FROM {SCHEMA}.user_progress WHERE user_id = %s ORDER BY ground_id",
            (user_id,)
        )
        progress = [dict(r) for r in cur.fetchall()]

        # Сертификаты
        cur.execute(
            f"SELECT ground_id, ground_title, issued_at FROM {SCHEMA}.certificates WHERE user_id = %s ORDER BY ground_id",
            (user_id,)
        )
        certificates = [dict(r) for r in cur.fetchall()]

        cur.close(); conn.close()

        return ok({
            "user": user,
            "progress": progress,
            "certificates": certificates,
            "completedGrounds": len([p for p in progress if p["status"] == "completed"]),
        })

    return err("Маршрут не найден", 404)