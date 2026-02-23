@echo off
chcp 65001 >nul
echo Отправляю изменения на GitHub...
git add .
set /p msg="Описание изменений: "
git commit -m "%msg%"
git push
echo.
echo Обновляю сервер...
ssh root@5.129.223.35 "cd /opt/digital-signage/ && git pull && pm2 restart signage"
echo.
echo Готово! Сервер обновлён.
pause
