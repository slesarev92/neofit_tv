# Загрузка APK на сервер в /opt/digital-signage/
# Требуется: OpenSSH (scp) — обычно есть в Windows 10/11.
#
# С момента появления Gradle product flavors у каждого клуба свой APK:
# app-neofit-debug.apk / app-labgym-debug.apk / app-soham-debug.apk.
# По умолчанию заливается app-neofit-debug.apk на хост NeoFit. Для других
# деплоев — указать -Flavor labgym/soham и при необходимости -ServerHost.
#
# Использование:
#   .\scripts\upload-apk.ps1                              # neofit → s9a.ru
#   .\scripts\upload-apk.ps1 -Flavor labgym -ServerHost tv.labgym.ru
#   .\scripts\upload-apk.ps1 -LocalPath "C:\path\to\app-neofit-debug.apk"

param(
    [string]$ServerHost = "s9a.ru",
    [string]$ServerUser = "root",
    [string]$RemoteDir = "/opt/digital-signage",
    [string]$LocalPath = "",
    [ValidateSet("neofit","labgym","soham")]
    [string]$Flavor = "neofit"
)

$ErrorActionPreference = "Stop"
$ApkName = "app-$Flavor-debug.apk"

# Локальный файл: переданный путь или app-{flavor}-debug.apk в корне проекта.
# Gradle кладёт собранный APK в android-app/app/build/outputs/apk/{flavor}/debug/
# — оттуда его нужно вручную скопировать в корень репо перед заливкой
# (см. docs/DEPLOYMENT.md).
if ($LocalPath -eq "") {
    $ScriptDir = Split-Path -Parent $PSScriptRoot
    $LocalPath = Join-Path $ScriptDir $ApkName
}

if (-not (Test-Path -LiteralPath $LocalPath)) {
    Write-Error "Файл не найден: $LocalPath. Укажите -LocalPath или положите $ApkName в корень проекта."
}

$RemotePath = "$RemoteDir/$ApkName"
$Target = "${ServerUser}@${ServerHost}:$RemotePath"

Write-Host "Загрузка: $LocalPath -> $Target"
scp -q "$LocalPath" "$Target"
if ($LASTEXITCODE -ne 0) {
    Write-Error "scp завершился с ошибкой. Проверьте SSH-доступ (ssh ${ServerUser}@${ServerHost}) и путь $RemoteDir."
}
Write-Host "Готово. Файл на сервере: $RemotePath"
