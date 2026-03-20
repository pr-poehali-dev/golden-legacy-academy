"""
Система прогрессии Академии Золотое Наследие.
action=complete_module — пользователь завершает модуль, система автоматически обновляет прогресс и выдаёт сертификат при 100%.
action=get_status — получить текущий статус пользователя по всем площадкам.
action=sync — синхронизация данных пользователя (объединение прогресса, сертификатов, уровня).
"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p86624112_golden_legacy_academ')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
    'Content-Type': 'application/json',
}

STATUSES = {
    0: 'Ученик',
    1: 'Наставник I ступени',
    2: 'Наставник II ступени',
    3: 'Наставник III ступени',
    4: 'Наставник IV ступени',
    5: 'Мастер-наставник',
}

GROUNDS = {
    1: {'title': 'Основы наставничества', 'modules': 8},
    2: {'title': 'Психология роста', 'modules': 10},
    3: {'title': 'Методы передачи знаний', 'modules': 12},
    4: {'title': 'Лидерство и влияние', 'modules': 10},
    5: {'title': 'Мастер-наставник', 'modules': 16},
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def ok(data, status=200):
    return {'statusCode': status, 'headers': CORS_HEADERS, 'body': json.dumps(data, ensure_ascii=False, default=str)}


def err(message, status=400):
    return {'statusCode': status, 'headers': CORS_HEADERS, 'body': json.dumps({'error': message}, ensure_ascii=False)}


def get_user_by_token(token, cur):
    if not token:
        return None
    cur.execute(
        f"""SELECT u.id, u.name, u.email, u.level, u.is_admin
            FROM {SCHEMA}.users u
            JOIN {SCHEMA}.sessions s ON s.user_id = u.id
            WHERE s.token = %s AND s.expires_at > NOW()""",
        (token,)
    )
    row = cur.fetchone()
    return dict(row) if row else None


def auto_promote(user_id, cur, conn):
    """Автоматически повышает уровень пользователя на основе количества сертификатов."""
    cur.execute(f"SELECT COUNT(DISTINCT ground_id) as cnt FROM {SCHEMA}.certificates WHERE user_id = %s", (user_id,))
    cert_count = cur.fetchone()['cnt']
    new_level = min(int(cert_count), 5)
    new_status = STATUSES.get(new_level, 'Ученик')
    cur.execute(
        f"UPDATE {SCHEMA}.users SET level = %s, status = %s WHERE id = %s AND level < %s",
        (new_level, new_status, user_id, new_level)
    )
    return new_level, new_status


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    qs = event.get('queryStringParameters') or {}
    action = qs.get('action', '')

    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            return err('Неверный формат запроса')

    headers = event.get('headers') or {}
    token = headers.get('X-Session-Token') or headers.get('x-session-token')

    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    user = get_user_by_token(token, cur)

    if not user:
        cur.close(); conn.close()
        return err('Требуется авторизация', 401)

    user_id = user['id']

    # POST ?action=complete_module — пользователь завершил модуль
    if method == 'POST' and action == 'complete_module':
        ground_id = body.get('ground_id')
        module_num = body.get('module_num')

        if not ground_id or not module_num:
            cur.close(); conn.close()
            return err('Укажите ground_id и module_num')

        ground_id = int(ground_id)
        module_num = int(module_num)

        if ground_id not in GROUNDS:
            cur.close(); conn.close()
            return err('Неверный номер площадки')

        ground = GROUNDS[ground_id]
        total_modules = ground['modules']

        # Проверяем, что площадка начата
        cur.execute(
            f"SELECT id, current_module, percent, status FROM {SCHEMA}.user_progress WHERE user_id = %s AND ground_id = %s",
            (user_id, ground_id)
        )
        progress = cur.fetchone()

        if not progress:
            # Автоматически начинаем площадку
            cur.execute(
                f"""INSERT INTO {SCHEMA}.user_progress (user_id, ground_id, current_module, total_modules, percent, status)
                    VALUES (%s, %s, 1, %s, 0, 'active')""",
                (user_id, ground_id, total_modules)
            )
            conn.commit()
            cur.execute(
                f"SELECT id, current_module, percent, status FROM {SCHEMA}.user_progress WHERE user_id = %s AND ground_id = %s",
                (user_id, ground_id)
            )
            progress = cur.fetchone()

        if progress['status'] == 'completed':
            cur.close(); conn.close()
            return ok({'message': 'Площадка уже завершена', 'already_completed': True})

        # Новый прогресс: завершённый модуль — следующий текущий
        new_module = min(module_num + 1, total_modules)
        new_percent = round((module_num / total_modules) * 100)
        new_percent = min(new_percent, 100)
        new_status = 'active'
        cert_issued = False
        level_up = False
        new_level = user['level']

        # Если завершили последний модуль — 100% и сертификат
        if module_num >= total_modules:
            new_percent = 100
            new_status = 'completed'
            new_module = total_modules

            # Выдаём сертификат
            cur.execute(
                f"""INSERT INTO {SCHEMA}.certificates (user_id, ground_id, ground_title)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (user_id, ground_id) DO UPDATE SET issued_at = NOW()""",
                (user_id, ground_id, ground['title'])
            )
            cert_issued = True

            # Автоматически повышаем уровень
            old_level = user['level']
            new_level, new_status_user = auto_promote(user_id, cur, conn)
            if new_level > old_level:
                level_up = True

        cur.execute(
            f"""UPDATE {SCHEMA}.user_progress
                SET current_module = %s, percent = %s, status = %s,
                    completed_at = CASE WHEN %s = 'completed' THEN NOW() ELSE completed_at END
                WHERE user_id = %s AND ground_id = %s""",
            (new_module, new_percent, new_status, new_status, user_id, ground_id)
        )
        conn.commit()

        # Проверяем, открылась ли следующая площадка
        next_ground_unlocked = False
        next_ground_id = ground_id + 1
        if new_status == 'completed' and next_ground_id in GROUNDS:
            cur.execute(
                f"SELECT id FROM {SCHEMA}.user_progress WHERE user_id = %s AND ground_id = %s",
                (user_id, next_ground_id)
            )
            if not cur.fetchone():
                next_ground_unlocked = True

        cur.close(); conn.close()

        return ok({
            'success': True,
            'ground_id': ground_id,
            'current_module': new_module,
            'total_modules': total_modules,
            'percent': new_percent,
            'status': new_status,
            'cert_issued': cert_issued,
            'level_up': level_up,
            'new_level': new_level,
            'new_level_title': STATUSES.get(new_level, 'Ученик'),
            'next_ground_unlocked': next_ground_unlocked,
            'next_ground_id': next_ground_id if next_ground_unlocked else None,
        })

    # GET ?action=get_status — полный статус пользователя
    if method == 'GET' and action == 'get_status':
        cur.execute(
            f"""SELECT u.id, u.name, u.email, u.level, u.is_admin,
                       u.status as level_title, u.created_at
                FROM {SCHEMA}.users u WHERE u.id = %s""",
            (user_id,)
        )
        u = dict(cur.fetchone())

        cur.execute(
            f"""SELECT ground_id, current_module, total_modules, percent, status, started_at, completed_at
                FROM {SCHEMA}.user_progress WHERE user_id = %s ORDER BY ground_id""",
            (user_id,)
        )
        progress_rows = [dict(r) for r in cur.fetchall()]

        cur.execute(
            f"SELECT ground_id, ground_title, issued_at FROM {SCHEMA}.certificates WHERE user_id = %s ORDER BY ground_id",
            (user_id,)
        )
        certs = [dict(r) for r in cur.fetchall()]

        # Рассчитываем доступные площадки
        completed_grounds = {p['ground_id'] for p in progress_rows if p['status'] == 'completed'}
        available_grounds = []
        for gid in sorted(GROUNDS.keys()):
            is_completed = gid in completed_grounds
            prev_completed = (gid == 1) or ((gid - 1) in completed_grounds)
            progress_item = next((p for p in progress_rows if p['ground_id'] == gid), None)
            available_grounds.append({
                'ground_id': gid,
                'title': GROUNDS[gid]['title'],
                'total_modules': GROUNDS[gid]['modules'],
                'is_available': prev_completed,
                'is_completed': is_completed,
                'is_started': progress_item is not None,
                'progress': progress_item,
            })

        cur.close(); conn.close()
        return ok({
            'user': u,
            'progress': progress_rows,
            'certificates': certs,
            'available_grounds': available_grounds,
            'completed_grounds_count': len(completed_grounds),
        })

    # GET ?action=sync — синхронизация (то же что get_status, но обновляет сессию)
    if method == 'GET' and action == 'sync':
        cur.execute(
            f"SELECT level, status FROM {SCHEMA}.users WHERE id = %s",
            (user_id,)
        )
        u = dict(cur.fetchone())

        cur.execute(
            f"SELECT ground_id, current_module, total_modules, percent, status FROM {SCHEMA}.user_progress WHERE user_id = %s",
            (user_id,)
        )
        progress_rows = [dict(r) for r in cur.fetchall()]

        cur.execute(
            f"SELECT ground_id FROM {SCHEMA}.certificates WHERE user_id = %s",
            (user_id,)
        )
        cert_ground_ids = [r['ground_id'] for r in cur.fetchall()]

        cur.close(); conn.close()
        return ok({
            'level': u['level'],
            'level_title': u['status'],
            'progress': progress_rows,
            'certified_grounds': cert_ground_ids,
        })

    cur.close(); conn.close()
    return err('Маршрут не найден', 404)
