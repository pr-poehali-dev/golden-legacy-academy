"""
Административная панель Академии Золотое Наследие.
action=users — список всех пользователей
action=issue_cert — выдать сертификат участнику
action=set_progress — установить прогресс/завершить площадку
action=start_ground — начать площадку для пользователя
Доступ только для пользователей с is_admin=true.
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

STATUSES = {
    0: "Ученик",
    1: "Наставник I ступени",
    2: "Наставник II ступени",
    3: "Наставник III ступени",
    4: "Наставник IV ступени",
    5: "Мастер-наставник",
}

GROUNDS = {
    1: {"title": "Основы наставничества", "modules": 8},
    2: {"title": "Психология роста", "modules": 10},
    3: {"title": "Методы передачи знаний", "modules": 12},
    4: {"title": "Лидерство и влияние", "modules": 10},
    5: {"title": "Мастер-наставник", "modules": 16},
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def ok(data, status=200):
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps(data, ensure_ascii=False, default=str)}


def err(message, status=400):
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps({"error": message}, ensure_ascii=False)}


def get_admin_user(token, cur):
    if not token:
        return None
    cur.execute(
        f"""SELECT u.id, u.name, u.email, u.is_admin
            FROM {SCHEMA}.users u
            JOIN {SCHEMA}.sessions s ON s.user_id = u.id
            WHERE s.token = %s AND s.expires_at > NOW()""",
        (token,)
    )
    row = cur.fetchone()
    if not row or not row["is_admin"]:
        return None
    return row


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

    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    admin = get_admin_user(token, cur)
    if not admin:
        cur.close(); conn.close()
        return err("Доступ запрещён", 403)

    # GET ?action=users — список пользователей с прогрессом
    if method == "GET" and action == "users":
        cur.execute(
            f"""SELECT u.id, u.name, u.email, u.status, u.level, u.is_admin, u.created_at,
                       COUNT(DISTINCT c.id) as cert_count,
                       COUNT(DISTINCT p.id) as progress_count
                FROM {SCHEMA}.users u
                LEFT JOIN {SCHEMA}.certificates c ON c.user_id = u.id
                LEFT JOIN {SCHEMA}.user_progress p ON p.user_id = u.id
                GROUP BY u.id ORDER BY u.created_at DESC"""
        )
        users = [dict(r) for r in cur.fetchall()]

        # Для каждого — детали прогресса
        for u in users:
            cur.execute(
                f"SELECT ground_id, status, percent, current_module, total_modules FROM {SCHEMA}.user_progress WHERE user_id = %s ORDER BY ground_id",
                (u["id"],)
            )
            u["progress"] = [dict(r) for r in cur.fetchall()]
            cur.execute(
                f"SELECT ground_id, ground_title, issued_at FROM {SCHEMA}.certificates WHERE user_id = %s ORDER BY ground_id",
                (u["id"],)
            )
            u["certificates"] = [dict(r) for r in cur.fetchall()]

        cur.close(); conn.close()
        return ok({"users": users})

    # POST ?action=issue_cert — выдать сертификат
    if method == "POST" and action == "issue_cert":
        user_id = body.get("user_id")
        ground_id = body.get("ground_id")
        if not user_id or not ground_id:
            cur.close(); conn.close()
            return err("Укажите user_id и ground_id")
        if ground_id not in GROUNDS:
            cur.close(); conn.close()
            return err("Неверный номер площадки")

        ground_title = GROUNDS[ground_id]["title"]

        # Выдаём сертификат (или обновляем если уже есть)
        cur.execute(
            f"""INSERT INTO {SCHEMA}.certificates (user_id, ground_id, ground_title)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, ground_id) DO UPDATE SET issued_at = NOW()
                RETURNING id""",
            (user_id, ground_id, ground_title)
        )

        # Помечаем площадку как завершённую
        cur.execute(
            f"""INSERT INTO {SCHEMA}.user_progress (user_id, ground_id, current_module, total_modules, percent, status, completed_at)
                VALUES (%s, %s, %s, %s, 100, 'completed', NOW())
                ON CONFLICT (user_id, ground_id) DO UPDATE
                SET status='completed', percent=100, current_module=EXCLUDED.total_modules, completed_at=NOW()""",
            (user_id, ground_id, GROUNDS[ground_id]["modules"], GROUNDS[ground_id]["modules"])
        )

        # Повышаем уровень пользователя если надо
        cur.execute(f"SELECT COUNT(DISTINCT ground_id) as cnt FROM {SCHEMA}.certificates WHERE user_id = %s", (user_id,))
        cert_count = cur.fetchone()["cnt"]
        new_level = min(int(cert_count), 5)
        new_status = STATUSES.get(new_level, "Ученик")
        cur.execute(
            f"UPDATE {SCHEMA}.users SET level = %s, status = %s WHERE id = %s",
            (new_level, new_status, user_id)
        )

        conn.commit()
        cur.close(); conn.close()
        return ok({"message": f"Сертификат за площадку {ground_id} выдан. Уровень: {new_level}", "new_level": new_level, "new_status": new_status})

    # POST ?action=set_progress — установить прогресс
    if method == "POST" and action == "set_progress":
        user_id = body.get("user_id")
        ground_id = body.get("ground_id")
        percent = body.get("percent", 0)
        module = body.get("current_module", 1)
        if not user_id or not ground_id:
            cur.close(); conn.close()
            return err("Укажите user_id и ground_id")
        if ground_id not in GROUNDS:
            cur.close(); conn.close()
            return err("Неверный номер площадки")

        total = GROUNDS[ground_id]["modules"]
        status = "completed" if percent >= 100 else "active"
        cur.execute(
            f"""INSERT INTO {SCHEMA}.user_progress (user_id, ground_id, current_module, total_modules, percent, status)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, ground_id) DO UPDATE
                SET current_module=%s, total_modules=%s, percent=%s, status=%s""",
            (user_id, ground_id, module, total, percent, status, module, total, percent, status)
        )
        conn.commit()
        cur.close(); conn.close()
        return ok({"message": f"Прогресс обновлён: {percent}%"})

    # POST ?action=start_ground — начать площадку
    if method == "POST" and action == "start_ground":
        user_id = body.get("user_id")
        ground_id = body.get("ground_id")
        if not user_id or not ground_id:
            cur.close(); conn.close()
            return err("Укажите user_id и ground_id")

        total = GROUNDS.get(ground_id, {}).get("modules", 8)
        cur.execute(
            f"""INSERT INTO {SCHEMA}.user_progress (user_id, ground_id, current_module, total_modules, percent, status)
                VALUES (%s, %s, 1, %s, 0, 'active')
                ON CONFLICT (user_id, ground_id) DO NOTHING""",
            (user_id, ground_id, total)
        )
        conn.commit()
        cur.close(); conn.close()
        return ok({"message": f"Площадка {ground_id} начата"})

    cur.close(); conn.close()
    return err("Маршрут не найден", 404)
