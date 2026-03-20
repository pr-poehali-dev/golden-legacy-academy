"""
Хранилище документов и медиафайлов Академии Золотое Наследие.
Поддерживает загрузку, просмотр и удаление файлов для площадок.
"""

import json
import os
import base64
import uuid
import psycopg2
import boto3
from datetime import datetime


SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p86624112_golden_legacy_academ')
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token, X-User-Id',
}


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )


def get_user(token, conn):
    if not token:
        return None
    cur = conn.cursor()
    cur.execute(
        f"SELECT u.id, u.name, u.email, u.level, u.is_admin FROM {SCHEMA}.sessions s "
        f"JOIN {SCHEMA}.users u ON u.id = s.user_id "
        f"WHERE s.token = %s AND s.expires_at > NOW()",
        (token,)
    )
    row = cur.fetchone()
    if not row:
        return None
    return {'id': row[0], 'name': row[1], 'email': row[2], 'level': row[3], 'is_admin': row[4]}


def resp(status, body, extra_headers=None):
    headers = {**CORS, 'Content-Type': 'application/json'}
    if extra_headers:
        headers.update(extra_headers)
    return {'statusCode': status, 'headers': headers, 'body': json.dumps(body, ensure_ascii=False, default=str)}


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', 'list')
    token = (event.get('headers') or {}).get('X-Session-Token', '')

    conn = get_db()
    user = get_user(token, conn)

    # GET /files?action=list[&ground_id=N]
    if method == 'GET' and action == 'list':
        ground_id = params.get('ground_id')
        cur = conn.cursor()
        if ground_id:
            cur.execute(
                f"SELECT id, ground_id, title, description, file_url, file_type, file_size, required_level, created_at "
                f"FROM {SCHEMA}.documents WHERE ground_id = %s AND is_public = TRUE ORDER BY created_at DESC",
                (int(ground_id),)
            )
        else:
            # Если нет фильтра — возвращаем все доступные пользователю
            level = user['level'] if user else 0
            cur.execute(
                f"SELECT id, ground_id, title, description, file_url, file_type, file_size, required_level, created_at "
                f"FROM {SCHEMA}.documents WHERE is_public = TRUE AND required_level <= %s ORDER BY ground_id, created_at DESC",
                (level,)
            )
        rows = cur.fetchall()
        files = [
            {
                'id': r[0], 'ground_id': r[1], 'title': r[2], 'description': r[3],
                'file_url': r[4], 'file_type': r[5], 'file_size': r[6],
                'required_level': r[7], 'created_at': str(r[8]),
            }
            for r in rows
        ]
        conn.close()
        return resp(200, {'files': files})

    # POST /files?action=upload  (только admin)
    if method == 'POST' and action == 'upload':
        if not user or not user['is_admin']:
            conn.close()
            return resp(403, {'error': 'Требуются права администратора'})

        body = json.loads(event.get('body') or '{}')
        ground_id = body.get('ground_id', 0)
        title = body.get('title', 'Без названия')
        description = body.get('description', '')
        file_data_b64 = body.get('file_data', '')
        file_name = body.get('file_name', 'file')
        file_type = body.get('file_type', 'document')
        required_level = int(body.get('required_level', 0))
        is_public = bool(body.get('is_public', True))

        # Декодируем и загружаем в S3
        file_bytes = base64.b64decode(file_data_b64)
        file_size = len(file_bytes)
        ext = file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else 'bin'
        file_key = f"academy/docs/{uuid.uuid4()}.{ext}"

        content_type_map = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
            'mp4': 'video/mp4', 'webm': 'video/webm',
        }
        content_type = content_type_map.get(ext, 'application/octet-stream')

        s3 = get_s3()
        s3.put_object(Bucket='files', Key=file_key, Body=file_bytes, ContentType=content_type)
        access_key = os.environ['AWS_ACCESS_KEY_ID']
        file_url = f"https://cdn.poehali.dev/projects/{access_key}/bucket/{file_key}"

        # Определяем file_type по расширению
        if ext in ('jpg', 'jpeg', 'png', 'gif', 'webp'):
            doc_type = 'image'
        elif ext in ('mp4', 'webm', 'mov'):
            doc_type = 'video'
        else:
            doc_type = 'document'

        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {SCHEMA}.documents (ground_id, title, description, file_key, file_url, file_type, file_size, uploaded_by, is_public, required_level) "
            f"VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (ground_id, title, description, file_key, file_url, doc_type, file_size, user['id'], is_public, required_level)
        )
        doc_id = cur.fetchone()[0]
        conn.commit()
        conn.close()
        return resp(201, {'id': doc_id, 'file_url': file_url, 'file_type': doc_type})

    # DELETE /files?action=delete&id=N  (только admin)
    if method == 'DELETE' and action == 'delete':
        if not user or not user['is_admin']:
            conn.close()
            return resp(403, {'error': 'Требуются права администратора'})

        doc_id = params.get('id')
        if not doc_id:
            conn.close()
            return resp(400, {'error': 'Не передан id файла'})

        cur = conn.cursor()
        cur.execute(f"SELECT file_key FROM {SCHEMA}.documents WHERE id = %s", (int(doc_id),))
        row = cur.fetchone()
        if not row:
            conn.close()
            return resp(404, {'error': 'Файл не найден'})

        file_key = row[0]
        s3 = get_s3()
        s3.delete_object(Bucket='files', Key=file_key)

        cur.execute(f"DELETE FROM {SCHEMA}.documents WHERE id = %s", (int(doc_id),))
        conn.commit()
        conn.close()
        return resp(200, {'success': True})

    conn.close()
    return resp(400, {'error': 'Неизвестный action'})
