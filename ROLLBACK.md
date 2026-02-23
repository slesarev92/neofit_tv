# Откат к предыдущим версиям

Версии зафиксированы тегами Git: `v3.0`, `v4.0`, `v11.0`, `v12.0`, `v13.0`, `v20.0`, `v21.0`, `v999.0`, `v9999.0`.

**Откатить весь проект к состоянию нужной версии (например 9999.0):**
```bash
cd /opt/digital-signage
git fetch --tags
git checkout v9999.0
```
Для версии 999.0: `git checkout v999.0`. Для 21.0: `git checkout v21.0`. Для 20.0: `git checkout v20.0`. Для 13.0: `git checkout v13.0`. Для 12.0: `git checkout v12.0`. Для 11.0: `git checkout v11.0`. Для 4.0: `git checkout v4.0`. Для 3.0: `git checkout v3.0`.

После этого рабочая копия будет в состоянии на момент выбранной версии. Чтобы вернуться к последним изменениям: `git checkout master` (или вашу основную ветку).

**Восстановить только отдельные файлы из версии:**
```bash
git checkout v999.0 -- путь/к/файлу
```

**Проверка, что откат работает:**
```bash
cd /opt/digital-signage
git checkout v9999.0
cat package.json | grep '"version"'   # должно быть "version": "9999.0.0"
git checkout master                   # вернуться к текущей ветке
```

**Список всех версий (тегов):**
```bash
git tag -l
```
