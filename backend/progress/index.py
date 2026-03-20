"""
Система прогрессии и материалов курсов Академии Золотое Наследие.
action=complete_module — завершить модуль (автоматическое повышение уровня, сертификат)
action=get_status — полный статус по всем площадкам
action=sync — синхронизация данных пользователя
action=start_ground — начать площадку
action=get_materials — получить материалы площадки (видео/текст/задания)
action=save_material — сохранить материал (только admin)
action=delete_material — удалить материал (только admin)
action=get_archive — история обучения, лог действий
action=log_action — записать действие пользователя
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

DEFAULT_MATERIALS = {
    1: [
        {'type': 'video', 'title': 'Введение в наставничество', 'description': 'Что такое наставничество и почему оно важно в современном мире', 'sort_order': 1},
        {'type': 'text', 'title': 'Философия передачи знаний', 'description': 'Основные принципы эффективного наставничества', 'sort_order': 2},
        {'type': 'task', 'title': 'Практика: Определите вашу роль', 'description': 'Первое задание — осознать свою позицию наставника', 'sort_order': 3},
        {'type': 'video', 'title': 'Доверие как основа отношений', 'description': 'Как выстроить доверительные отношения с подопечным', 'sort_order': 4},
        {'type': 'text', 'title': 'Методика активного слушания', 'description': 'Техники, помогающие понять подопечного глубже', 'sort_order': 5},
        {'type': 'task', 'title': 'Практика: Первая сессия', 'description': 'Проведите пробную сессию и запишите наблюдения', 'sort_order': 6},
        {'type': 'video', 'title': 'Этика наставника', 'description': 'Границы, конфиденциальность и ответственность', 'sort_order': 7},
        {'type': 'task', 'title': 'Итоговое задание площадки', 'description': 'Создайте свой кодекс наставника', 'sort_order': 8},
    ],
    2: [
        {'type': 'video', 'title': 'Психология развития взрослых', 'description': 'Стадии развития личности и их влияние на обучение', 'sort_order': 1},
        {'type': 'text', 'title': 'Теория мотивации', 'description': 'Внутренняя и внешняя мотивация: как работает каждая', 'sort_order': 2},
        {'type': 'video', 'title': 'Саботирующие убеждения', 'description': 'Как помочь подопечному преодолеть ограничивающие установки', 'sort_order': 3},
        {'type': 'task', 'title': 'Диагностика мотивации', 'description': 'Инструмент для выявления движущих сил вашего подопечного', 'sort_order': 4},
        {'type': 'video', 'title': 'Эмоциональный интеллект', 'description': 'EQ как ключевой навык наставника', 'sort_order': 5},
        {'type': 'text', 'title': 'Работа с сопротивлением', 'description': 'Почему подопечные сопротивляются и что с этим делать', 'sort_order': 6},
        {'type': 'task', 'title': 'Практика: Анализ блоков', 'description': 'Работа с реальным кейсом из вашей практики', 'sort_order': 7},
        {'type': 'video', 'title': 'Раскрытие потенциала', 'description': 'Методы активации скрытых ресурсов человека', 'sort_order': 8},
        {'type': 'text', 'title': 'Зона ближайшего развития', 'description': 'Теория Выготского в практике наставничества', 'sort_order': 9},
        {'type': 'task', 'title': 'Итоговый проект площадки', 'description': 'Разработайте индивидуальную программу для реального подопечного', 'sort_order': 10},
    ],
    3: [
        {'type': 'video', 'title': 'Структура наставнической программы', 'description': 'Как выстроить систему обучения от А до Я', 'sort_order': 1},
        {'type': 'text', 'title': 'Методы Сократа и Коуч-подход', 'description': 'Вопросы как главный инструмент наставника', 'sort_order': 2},
        {'type': 'video', 'title': 'GROW-модель в наставничестве', 'description': 'Универсальный фреймворк для наставнических сессий', 'sort_order': 3},
        {'type': 'task', 'title': 'Практика: Сессия по GROW', 'description': 'Проведите сессию по модели и получите обратную связь', 'sort_order': 4},
        {'type': 'video', 'title': 'Постановка целей SMART', 'description': 'Как помочь подопечному сформулировать измеримые цели', 'sort_order': 5},
        {'type': 'text', 'title': 'Обратная связь без критики', 'description': 'Техники развивающей обратной связи', 'sort_order': 6},
        {'type': 'task', 'title': 'Практика: Мини-программа', 'description': 'Создайте 4-недельный план развития для подопечного', 'sort_order': 7},
        {'type': 'video', 'title': 'Визуальные инструменты наставника', 'description': 'Карты, схемы и другие визуальные методы', 'sort_order': 8},
        {'type': 'text', 'title': 'Документирование прогресса', 'description': 'Как фиксировать и отслеживать результаты', 'sort_order': 9},
        {'type': 'video', 'title': 'Групповое наставничество', 'description': 'Работа с группой: особенности и методы', 'sort_order': 10},
        {'type': 'task', 'title': 'Практика: Групповая сессия', 'description': 'Проведите групповую встречу и проанализируйте результат', 'sort_order': 11},
        {'type': 'task', 'title': 'Итоговый проект: Авторская методика', 'description': 'Опишите вашу уникальную методику наставничества', 'sort_order': 12},
    ],
    4: [
        {'type': 'video', 'title': 'Лидерство как служение', 'description': 'Servant Leadership и почему это основа настоящего влияния', 'sort_order': 1},
        {'type': 'text', 'title': 'Персональный бренд эксперта', 'description': 'Как сформировать репутацию признанного наставника', 'sort_order': 2},
        {'type': 'video', 'title': 'Публичные выступления', 'description': 'Как говорить так, чтобы вас слушали и помнили', 'sort_order': 3},
        {'type': 'task', 'title': 'Практика: Ваш экспертный профиль', 'description': 'Создайте описание себя как эксперта', 'sort_order': 4},
        {'type': 'video', 'title': 'Создание сообщества', 'description': 'Как вокруг вас собирается круг последователей', 'sort_order': 5},
        {'type': 'text', 'title': 'Наставничество через контент', 'description': 'Статьи, книги, подкасты как форма наставничества', 'sort_order': 6},
        {'type': 'task', 'title': 'Практика: Ваш манифест', 'description': 'Напишите текст о своей миссии наставника', 'sort_order': 7},
        {'type': 'video', 'title': 'Расширение круга влияния', 'description': 'Стратегии привлечения подопечных и партнёров', 'sort_order': 8},
        {'type': 'text', 'title': 'Монетизация наставничества', 'description': 'Модели дохода профессионального наставника', 'sort_order': 9},
        {'type': 'task', 'title': 'Итоговый проект: Стратегия влияния', 'description': 'Разработайте план развития вашего влияния на год', 'sort_order': 10},
    ],
    5: [
        {'type': 'video', 'title': 'Путь Мастера', 'description': 'Что значит быть Мастером-наставником и нести наследие', 'sort_order': 1},
        {'type': 'text', 'title': 'Создание школы наставничества', 'description': 'Юридические, организационные и методические основы', 'sort_order': 2},
        {'type': 'video', 'title': 'Программа подготовки наставников', 'description': 'Как обучать тех, кто будет обучать других', 'sort_order': 3},
        {'type': 'task', 'title': 'Практика: Концепция школы', 'description': 'Опишите концепцию вашей школы наставничества', 'sort_order': 4},
        {'type': 'video', 'title': 'Система качества в обучении', 'description': 'Стандарты, оценка и сертификация результатов', 'sort_order': 5},
        {'type': 'text', 'title': 'Наследие и преемственность', 'description': 'Как передать ценности и знания следующим поколениям', 'sort_order': 6},
        {'type': 'task', 'title': 'Практика: Первые наставники школы', 'description': 'Отберите и начните подготовку 3 наставников', 'sort_order': 7},
        {'type': 'video', 'title': 'Масштабирование через наставников', 'description': 'Как умножить своё влияние через учеников', 'sort_order': 8},
        {'type': 'text', 'title': 'Международный опыт', 'description': 'Лучшие школы наставничества мира и их методики', 'sort_order': 9},
        {'type': 'task', 'title': 'Практика: Партнёрства', 'description': 'Установите 5 партнёрских связей для школы', 'sort_order': 10},
        {'type': 'video', 'title': 'Финансовая модель школы', 'description': 'Устойчивая бизнес-модель образовательной организации', 'sort_order': 11},
        {'type': 'text', 'title': 'Цифровые инструменты', 'description': 'Технологии для современной школы наставничества', 'sort_order': 12},
        {'type': 'task', 'title': 'Практика: Цифровая платформа', 'description': 'Разработайте требования к онлайн-пространству школы', 'sort_order': 13},
        {'type': 'video', 'title': 'Вечная ценность наставничества', 'description': 'Исторические примеры и вдохновляющие истории', 'sort_order': 14},
        {'type': 'text', 'title': 'Кодекс Мастера-наставника', 'description': 'Принципы и обязательства на высшей ступени', 'sort_order': 15},
        {'type': 'task', 'title': 'Финальный проект: Ваше Наследие', 'description': 'Опишите наследие, которое вы оставите после себя', 'sort_order': 16},
    ],
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def seed_default_materials(ground_id, cur, conn):
    mats = DEFAULT_MATERIALS.get(ground_id, [])
    for m in mats:
        cur.execute(
            f"""INSERT INTO {SCHEMA}.course_materials (ground_id, type, title, description, sort_order)
                VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING""",
            (ground_id, m['type'], m['title'], m['description'], m['sort_order'])
        )
    conn.commit()


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
    user_id = user['id'] if user else None

    # Публичные маршруты (не требуют авторизации)
    if action == 'get_materials':
        ground_id = int(qs.get('ground_id', 0))
        if ground_id not in GROUNDS:
            cur.close(); conn.close()
            return err('Неверный номер площадки')

        cur.execute(f"SELECT COUNT(*) as cnt FROM {SCHEMA}.course_materials WHERE ground_id = %s", (ground_id,))
        if cur.fetchone()['cnt'] == 0:
            seed_default_materials(ground_id, cur, conn)

        cur.execute(
            f"""SELECT id, ground_id, type, title, description, content_url, content_data, sort_order
                FROM {SCHEMA}.course_materials WHERE ground_id=%s ORDER BY sort_order ASC""",
            (ground_id,)
        )
        materials = [dict(r) for r in cur.fetchall()]

        progress = None
        is_available = False
        if user_id:
            cur.execute(
                f"SELECT current_module, total_modules, percent, status FROM {SCHEMA}.user_progress WHERE user_id=%s AND ground_id=%s",
                (user_id, ground_id)
            )
            prog_row = cur.fetchone()
            if prog_row:
                progress = dict(prog_row)
            if ground_id == 1:
                is_available = True
            else:
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.user_progress WHERE user_id=%s AND ground_id=%s AND status='completed'",
                    (user_id, ground_id - 1)
                )
                is_available = cur.fetchone() is not None

        cur.close(); conn.close()
        return ok({
            'ground_id': ground_id,
            'ground_title': GROUNDS[ground_id]['title'],
            'total_modules': GROUNDS[ground_id]['modules'],
            'materials': materials,
            'progress': progress,
            'is_available': is_available,
        })

    # Все остальные маршруты требуют авторизации
    if not user:
        cur.close(); conn.close()
        return err('Требуется авторизация', 401)

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

    # POST ?action=save_material — сохранить материал (только admin)
    if method == 'POST' and action == 'save_material':
        if not user or not user.get('is_admin'):
            cur.close(); conn.close()
            return err('Недостаточно прав', 403)
        mat_id = body.get('id')
        ground_id = int(body.get('ground_id', 0))
        mat_type = body.get('type', 'text')
        title = (body.get('title') or '').strip()
        description = (body.get('description') or '').strip()
        content_url = (body.get('content_url') or '').strip()
        content_data = (body.get('content_data') or '').strip()
        sort_order = int(body.get('sort_order', 0))
        if not title or ground_id not in GROUNDS:
            cur.close(); conn.close()
            return err('Заполните обязательные поля')
        if mat_type not in ('video', 'text', 'task', 'file', 'link'):
            cur.close(); conn.close()
            return err('Неверный тип материала')
        if mat_id:
            cur.execute(
                f"""UPDATE {SCHEMA}.course_materials
                    SET type=%s, title=%s, description=%s, content_url=%s, content_data=%s, sort_order=%s, updated_by=%s
                    WHERE id=%s""",
                (mat_type, title, description, content_url, content_data, sort_order, user_id, mat_id)
            )
        else:
            cur.execute(
                f"""INSERT INTO {SCHEMA}.course_materials (ground_id, type, title, description, content_url, content_data, sort_order, updated_by)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (ground_id, mat_type, title, description, content_url, content_data, sort_order, user_id)
            )
            mat_id = cur.fetchone()['id']
        conn.commit()
        cur.close(); conn.close()
        return ok({'success': True, 'id': mat_id})

    # DELETE ?action=delete_material&id=5
    if method == 'DELETE' and action == 'delete_material':
        if not user or not user.get('is_admin'):
            cur.close(); conn.close()
            return err('Недостаточно прав', 403)
        mat_id = int(qs.get('id', 0))
        if not mat_id:
            cur.close(); conn.close()
            return err('Укажите id')
        cur.execute(f"DELETE FROM {SCHEMA}.course_materials WHERE id=%s", (mat_id,))
        conn.commit()
        cur.close(); conn.close()
        return ok({'success': True})

    # GET ?action=get_archive — история обучения
    if action == 'get_archive':
        cur.execute(
            f"""SELECT ground_id, current_module, total_modules, percent, status, started_at, completed_at
                FROM {SCHEMA}.user_progress WHERE user_id=%s ORDER BY ground_id""",
            (user_id,)
        )
        progress_rows = [dict(r) for r in cur.fetchall()]
        cur.execute(
            f"SELECT ground_id, ground_title, issued_at FROM {SCHEMA}.certificates WHERE user_id=%s ORDER BY issued_at DESC",
            (user_id,)
        )
        certs = [dict(r) for r in cur.fetchall()]
        cur.execute(
            f"SELECT action, details, created_at FROM {SCHEMA}.user_actions_log WHERE user_id=%s ORDER BY created_at DESC LIMIT 50",
            (user_id,)
        )
        actions = [dict(r) for r in cur.fetchall()]
        completed_count = len([p for p in progress_rows if p['status'] == 'completed'])
        total_modules_done = sum(max(0, p['current_module'] - 1) for p in progress_rows)
        cur.close(); conn.close()
        return ok({
            'progress': progress_rows,
            'certificates': certs,
            'actions': actions,
            'stats': {
                'completed_grounds': completed_count,
                'certificates_count': len(certs),
                'total_modules_done': total_modules_done,
                'active_grounds_count': len([p for p in progress_rows if p['status'] == 'active']),
            }
        })

    # POST ?action=log_action — записать действие
    if method == 'POST' and action == 'log_action':
        action_name = (body.get('action') or '').strip()
        details = (body.get('details') or '').strip()
        if not action_name:
            cur.close(); conn.close()
            return err('Укажите action')
        cur.execute(
            f"INSERT INTO {SCHEMA}.user_actions_log (user_id, action, details) VALUES (%s, %s, %s)",
            (user_id, action_name[:100], details[:500])
        )
        conn.commit()
        cur.close(); conn.close()
        return ok({'success': True})

    # POST ?action=start_ground — начать площадку
    if method == 'POST' and action == 'start_ground':
        ground_id = int(body.get('ground_id', 0))
        if ground_id not in GROUNDS:
            cur.close(); conn.close()
            return err('Неверная площадка')
        if ground_id > 1:
            cur.execute(
                f"SELECT id FROM {SCHEMA}.user_progress WHERE user_id=%s AND ground_id=%s AND status='completed'",
                (user_id, ground_id - 1)
            )
            if not cur.fetchone():
                cur.close(); conn.close()
                return err('Сначала завершите предыдущую площадку', 403)
        cur.execute(
            f"SELECT id, status FROM {SCHEMA}.user_progress WHERE user_id=%s AND ground_id=%s",
            (user_id, ground_id)
        )
        existing = cur.fetchone()
        if existing:
            cur.close(); conn.close()
            return ok({'success': True, 'already_started': True, 'status': existing['status']})
        cur.execute(
            f"""INSERT INTO {SCHEMA}.user_progress (user_id, ground_id, current_module, total_modules, percent, status)
                VALUES (%s, %s, 1, %s, 0, 'active')""",
            (user_id, ground_id, GROUNDS[ground_id]['modules'])
        )
        cur.execute(
            f"INSERT INTO {SCHEMA}.user_actions_log (user_id, action, details) VALUES (%s, 'start_ground', %s)",
            (user_id, f'Начал площадку {ground_id}: {GROUNDS[ground_id]["title"]}')
        )
        conn.commit()
        cur.close(); conn.close()
        return ok({'success': True, 'message': f'Площадка «{GROUNDS[ground_id]["title"]}» начата!'})

    cur.close(); conn.close()
    return err('Маршрут не найден', 404)