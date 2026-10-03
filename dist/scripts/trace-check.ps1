# TRACE: локальная проверка. Windows PowerShell 5.1 / PowerShell 7.
# Прочитайте этот файл перед запуском. Сеть не используется, реестр не меняется, права не повышаются.
# Отчёт записывается только в новую папку со случайным именем во временной папке Windows.
# Файл сохранён в UTF-8 с BOM, чтобы Windows PowerShell 5.1 правильно прочитал русский текст.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Write-Host 'TRACE: локальная проверка. Это не автоматический детектор читов.'
Write-Host 'Сохраняет имена, идентификаторы и доступные пути процессов. В путях может быть имя пользователя.'
Write-Host 'По желанию считает SHA-256 для файлов .exe, .dll, .asi и .jar в одной папке игры, которую вы укажете.'
Write-Host 'Ничего не отправляется. Не передавайте отчёт, пока не просмотрите его.'
$answer = [string](Read-Host 'Введите ДА, если это ваш компьютер или его владелец согласен на проверку')
if ($answer.Trim() -notin @('ДА', 'YES')) { Write-Host 'Отменено. Отчёт не создан.'; return }
try {
  $reportDir = Join-Path ([System.IO.Path]::GetTempPath()) ('TRACE-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $reportDir -ErrorAction Stop | Out-Null
  $processes = @(Get-Process | ForEach-Object {
    $itemPath = $null
    try { $itemPath = $_.Path } catch { }
    [pscustomobject]@{ 'Имя' = $_.ProcessName; 'PID' = $_.Id; 'Путь' = $itemPath; 'Путь доступен' = $(if ($itemPath) { 'да' } else { 'нет: обычное ограничение прав' }) }
  })
  $processes | Sort-Object 'Имя' | Export-Csv -LiteralPath (Join-Path $reportDir 'processes.csv') -NoTypeInformation -Encoding UTF8
  Write-Host 'Список процессов сохранён. Пустой путь не говорит о чите.'
  $gameFolder = Read-Host 'Необязательно: вставьте путь к ЛОКАЛЬНОЙ папке игры, чтобы посчитать контрольные суммы, или нажмите Enter'
  $notes = [System.Collections.Generic.List[string]]::new()
  $notes.Add('Отчёт TRACE, создан ' + (Get-Date).ToString('dd.MM.yyyy HH:mm:ss') + ' (местное время)')
  $notes.Add('Процессов: ' + $processes.Count)
  $notes.Add('Вывода о читах нет. Контрольные суммы НЕ сверялись ни с какой базой проверенных файлов.')
  if (-not [string]::IsNullOrWhiteSpace($gameFolder)) {
    $gameFolder = $gameFolder.Trim().Trim('"')
    if ($gameFolder -notmatch '^[A-Za-z]:\\' -or -not (Test-Path -LiteralPath $gameFolder -PathType Container)) { throw 'Укажите существующую локальную папку, например C:\Games\MyGame (не сетевую).' }
    $resolved = (Resolve-Path -LiteralPath $gameFolder).Path
    $driveInfo = [System.IO.DriveInfo]::new([System.IO.Path]::GetPathRoot($resolved))
    if ($driveInfo.DriveType -ne [System.IO.DriveType]::Fixed -and $driveInfo.DriveType -ne [System.IO.DriveType]::Removable) { throw 'Поддерживаются только локальные диски.' }
    $rootItem = Get-Item -LiteralPath $resolved
    if ($rootItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'Ссылки и точки соединения не проверяются.' }
    $queue = [System.Collections.Generic.Queue[string]]::new(); $queue.Enqueue($resolved)
    $results = [System.Collections.Generic.List[object]]::new()
    $visited = 0
    while ($queue.Count -gt 0 -and $results.Count -lt 500 -and $visited -lt 2000) {
      $folder = $queue.Dequeue(); $visited++
      try { $children = @(Get-ChildItem -LiteralPath $folder -Force -ErrorAction Stop) } catch { $notes.Add('Папка не читается: ' + $folder); continue }
      foreach ($file in $children) {
        if ($file.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { continue }
        if ($file.PSIsContainer) { $queue.Enqueue($file.FullName); continue }
        if ($file.Extension.ToLowerInvariant() -notin @('.exe','.dll','.asi','.jar')) { continue }
        if ($results.Count -ge 500) { break }
        $hash = ''; $status = 'посчитано'
        if ($file.Length -gt 100MB) { $status = 'пропущен: больше 100 МБ' } else {
          try { $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256 -ErrorAction Stop).Hash } catch { $status = 'не читается: ' + $_.Exception.Message }
        }
        $results.Add([pscustomobject]@{ 'Файл' = $file.FullName; 'Байт' = $file.Length; 'SHA256' = $hash; 'Состояние' = $status })
      }
    }
    if ($results.Count -gt 0) { $results | Export-Csv -LiteralPath (Join-Path $reportDir 'game-files.csv') -NoTypeInformation -Encoding UTF8 }
    $notes.Add('Строк с файлами: ' + $results.Count)
    $notes.Add('Охват: только выбранная папка; не больше 500 строк и 2000 папок; ссылки и точки соединения не обходятся; файлы больше 100 МБ не хешируются.')
    if ($results.Count -ge 500 -or $visited -ge 2000) { $notes.Add('ДОСТИГНУТ ПРЕДЕЛ: отчёт неполный.'); Write-Warning 'Достигнут предел, отчёт неполный.' }
  } else { $notes.Add('Проверка файлов игры пропущена по выбору пользователя.') }
  $notes.Add('Перед отправкой просмотрите отчёт и уберите личные пути. Ctrl+C прерывает проверку. Чтобы удалить отчёт, удалите эту папку.')
  $notes | Set-Content -LiteralPath (Join-Path $reportDir 'README.txt') -Encoding UTF8
  Write-Host ('Папка отчёта: ' + $reportDir)
  Write-Host 'Готово. Ничего не отправлено, вывода о читах нет.'
} catch {
  Write-Error ('Проверка остановлена: ' + $_.Exception.Message) -ErrorAction Continue
  if ($reportDir) { Write-Host ('Часть отчёта может быть в папке: ' + $reportDir) }
}
