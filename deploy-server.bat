@echo off
chcp 65001 >nul
echo Обновляю боевой сервер (git pull + npm install + pm2 restart)...
ssh root@5.129.223.35 "cd /opt/digital-signage && git pull && npm install --production && pm2 restart signage"
if %errorlevel% equ 0 (
  echo.
  echo Готово. Сервер обновлён.
) else (
  echo.
  echo Ошибка при обновлении. Проверьте SSH и путь /opt/digital-signage на сервере.
)
pause
