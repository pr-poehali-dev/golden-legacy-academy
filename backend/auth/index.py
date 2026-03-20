"""
Авторизация пользователей Академии Золотое Наследие.
action=register, action=login, action=logout, action=profile, action=update_profile, action=change_password
"""
import json
import os
import hashlib
import secrets
import re
import psycopg2
from psycopg2.extras import RealDictCursor

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
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

    # POST ?action=update_profile — обновить данные профиля
    if method == "POST" and action == "update_profile":
        if not token:
            return err("Требуется авторизация", 401)

        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            f"""SELECT u.id FROM {SCHEMA}.users u
                JOIN {SCHEMA}.sessions s ON s.user_id = u.id
                WHERE s.token = %s AND s.expires_at > NOW()""",
            (token,)
        )
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return err("Сессия истекла", 401)

        user_id = row["id"]

        name = (body.get("name") or "").strip()
        phone = (body.get("phone") or "").strip()
        country = (body.get("country") or "").strip()
        bio = (body.get("bio") or "").strip()
        goals = (body.get("goals") or "").strip()
        social_linkedin = (body.get("social_linkedin") or "").strip()
        social_telegram = (body.get("social_telegram") or "").strip()
        notify_email = bool(body.get("notify_email", True))
        notify_push = bool(body.get("notify_push", False))

        if not name:
            cur.close(); conn.close()
            return err("Имя не может быть пустым")
        if len(name) < 2:
            cur.close(); conn.close()
            return err("Имя должно быть не менее 2 символов")
        if len(name) > 100:
            cur.close(); conn.close()
            return err("Имя не должно превышать 100 символов")
        if phone and not re.match(r'^[\+\d\s\-\(\)]{7,20}$', phone):
            cur.close(); conn.close()
            return err("Неверный формат телефона")
        if len(bio) > 1000:
            cur.close(); conn.close()
            return err("Описание не должно превышать 1000 символов")
        if len(goals) > 500:
            cur.close(); conn.close()
            return err("Цели не должны превышать 500 символов")
        if social_telegram and not re.match(r'^@?[\w]{3,}$', social_telegram):
            cur.close(); conn.close()
            return err("Неверный формат Telegram (например: @username)")

        cur.execute(
            f"""UPDATE {SCHEMA}.users
                SET name=%s, phone=%s, country=%s, bio=%s, goals=%s,
                    social_linkedin=%s, social_telegram=%s,
                    notify_email=%s, notify_push=%s
                WHERE id=%s""",
            (name, phone, country, bio, goals, social_linkedin, social_telegram,
             notify_email, notify_push, user_id)
        )
        cur.execute(
            f"""INSERT INTO {SCHEMA}.user_actions_log (user_id, action, details)
                VALUES (%s, 'update_profile', 'Обновил данные профиля')""",
            (user_id,)
        )
        conn.commit()
        cur.close(); conn.close()
        return ok({"success": True, "message": "Профиль обновлён"})

    # POST ?action=change_password — смена пароля с проверкой текущего
    if method == "POST" and action == "change_password":
        if not token:
            return err("Требуется авторизация", 401)

        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            f"""SELECT u.id, u.password_hash FROM {SCHEMA}.users u
                JOIN {SCHEMA}.sessions s ON s.user_id = u.id
                WHERE s.token = %s AND s.expires_at > NOW()""",
            (token,)
        )
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return err("Сессия истекла", 401)

        user_id = row["id"]
        current_password = body.get("current_password") or ""
        new_password = body.get("new_password") or ""
        confirm_password = body.get("confirm_password") or ""

        if not current_password or not new_password or not confirm_password:
            cur.close(); conn.close()
            return err("Заполните все поля")
        if row["password_hash"] != hash_password(current_password):
            cur.close(); conn.close()
            return err("Текущий пароль неверный", 403)
        if len(new_password) < 6:
            cur.close(); conn.close()
            return err("Новый пароль должен быть не менее 6 символов")
        if new_password != confirm_password:
            cur.close(); conn.close()
            return err("Пароли не совпадают")
        if new_password == current_password:
            cur.close(); conn.close()
            return err("Новый пароль должен отличаться от текущего")

        cur.execute(
            f"UPDATE {SCHEMA}.users SET password_hash=%s WHERE id=%s",
            (hash_password(new_password), user_id)
        )
        cur.execute(
            f"UPDATE {SCHEMA}.sessions SET expires_at=NOW() WHERE user_id=%s AND token!=%s",
            (user_id, token)
        )
        cur.execute(
            f"""INSERT INTO {SCHEMA}.user_actions_log (user_id, action, details)
                VALUES (%s, 'change_password', 'Изменил пароль')""",
            (user_id,)
        )
        conn.commit()
        cur.close(); conn.close()
        return ok({"success": True, "message": "Пароль успешно изменён"})

    return err("Маршрут не найден", 404)