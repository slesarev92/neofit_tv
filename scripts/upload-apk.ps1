# Загрузка app-debug.apk на сервер в /opt/digital-signage/
# Требуется: OpenSSH (scp) — обычно есть в Windows 10/11.
#
# Использование:
#   .\scripts\upload-apk.ps1
#   .\scripts\upload-apk.ps1 -LocalPath "C:\path\to\app-debug.apk"
#   .\scripts\upload-apk.ps1 -ServerUser deploy -ServerHost s9a.ru

param(
    [string]$ServerHost = "s9a.ru",
    [string]$ServerUser = "root",
    [string]$RemoteDir = "/opt/digital-signage",
    [string]$LocalPath = ""
)

$ErrorActionPreference = "Stop"
$ApkName = "app-debug.apk"

# Локальный файл: переданный путь или app-debug.apk в корне проекта (рядом со скриптом — на 2 уровня выше)
if ($LocalPath -eq "") {
    $ScriptDir = Split-Path -Parent $PSScriptRoot
    $LocalPath = Join-Path $ScriptDir $ApkName
}

if (-not (Test-Path -LiteralPath $LocalPath)) {
    Write-Error "Файл не найден: $LocalPath. Укажите -LocalPath или положите app-debug.apk в корень проекта."
}

$RemotePath = "$RemoteDir/$ApkName"
$Target = "${ServerUser}@${ServerHost}:$RemotePath"

Write-Host "Загрузка: $LocalPath -> $Target"
scp -q "$LocalPath" "$Target"
if ($LASTEXITCODE -ne 0) {
    Write-Error "scp завершился с ошибкой. Проверьте SSH-доступ (ssh ${ServerUser}@${ServerHost}) и путь $RemoteDir."
}
Write-Host "Готово. Файл на сервере: $RemotePath"
