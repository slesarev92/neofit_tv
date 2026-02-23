#!/bin/bash
# Добавляет задачу в crontab — бэкап каждый день в 03:00
# Запустите из корня проекта: bash scripts/setup-cron.sh
# Перед запуском замените /opt/digital-signage на путь к вашему проекту.

PROJECT_DIR="${1:-/opt/digital-signage}"
CRON_LINE="0 3 * * * cd ${PROJECT_DIR} && npm run backup >> ${PROJECT_DIR}/logs/backup.log 2>&1"

(crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
echo "✅ Cron задача добавлена. Бэкап каждый день в 03:00"
echo "   Путь к проекту: ${PROJECT_DIR}"
echo "   Лог: ${PROJECT_DIR}/logs/backup.log"
