"""
Управление контентом сайта Академии Золотое Наследие.
GET  ?action=all   — получить все тексты (публично)
POST ?action=save  — сохранить ключ/значение (только admin)
"""
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Token",
    "Content-Type": "application/json",
}

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p86624112_golden_legacy_academ")


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def ok(data, status=200):
    return {"statusCode": status, "headers": CORS_HEADERS,
            "body": json.dumps(data, ensure_ascii=False, default=str)}


def err(message, status=400):
    return {"statusCode": status, "headers": CORS_HEADERS,
            "body": json.dumps({"error": message}, ensure_ascii=False)}


def get_admin(token, cur):
    if not token:
        return None
    cur.execute(
        f"""SELECT u.id FROM {SCHEMA}.users u
            JOIN {SCHEMA}.sessions s ON s.user_id = u.id
            WHERE s.token = %s AND s.expires_at > NOW() AND u.is_admin = TRUE""",
        (token,)
    )
    return cur.fetchone()


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "all")

    headers = event.get("headers") or {}
    token = headers.get("X-Session-Token") or headers.get("x-session-token")

    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # GET ?action=all — публичное получение всего контента
    if method == "GET" and action == "all":
        cur.execute(f"SELECT key, value FROM {SCHEMA}.site_content ORDER BY key")
        rows = cur.fetchall()
        content = {r["key"]: r["value"] for r in rows}
        cur.close(); conn.close()
        return ok({"content": content})

    # POST ?action=save — сохранить один ключ (только admin)
    if method == "POST" and action == "save":
        admin = get_admin(token, cur)
        if not admin:
            cur.close(); conn.close()
            return err("Доступ запрещён", 403)

        body = {}
        if event.get("body"):
            try:
                body = json.loads(event["body"])
            except Exception:
                cur.close(); conn.close()
                return err("Неверный формат запроса")

        key = (body.get("key") or "").strip()
        value = body.get("value", "")

        if not key:
            cur.close(); conn.close()
            return err("Укажите key")

        cur.execute(
            f"""INSERT INTO {SCHEMA}.site_content (key, value, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()""",
            (key, value)
        )
        conn.commit()
        cur.close(); conn.close()
        return ok({"message": "Сохранено", "key": key, "value": value})

    cur.close(); conn.close()
    return err("Маршрут не найден", 404)
