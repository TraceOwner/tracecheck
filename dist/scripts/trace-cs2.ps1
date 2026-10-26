#requires -Version 5.1
# TRACE: локальная проверка Counter-Strike 2. Только чтение: ничего не удаляет и не отправляет в сеть.
# Запуск: powershell -NoProfile -ExecutionPolicy Bypass -File .\trace-cs2.ps1   (-SkipIntro убирает заставку)
[CmdletBinding()]
param([switch]$SkipIntro)

if (-not $SkipIntro) {
  $art = @(
    '████████╗██████╗  █████╗  ██████╗███████╗',
    '╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██╔════╝',
    '   ██║   ██████╔╝███████║██║     █████╗  ',
    '   ██║   ██╔══██╗██╔══██║██║     ██╔══╝  ',
    '   ██║   ██║  ██║██║  ██║╚██████╗███████╗',
    '   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝'
  )
  foreach ($line in $art) { Write-Host ('  ' + $line) -ForegroundColor Gray }
  Write-Host ''
}
Write-Host ('TRACE · Counter-Strike 2 · Всё сразу · ' + (Get-Date).ToString('dd.MM.yyyy HH:mm')) -ForegroundColor White
$ErrorActionPreference = 'SilentlyContinue'
$strong = @('midnight.im', 'neverlose', 'memesense', 'osiriscs2', 'aimware', 'nixware')
$weak = @('osiris')
$rx = [regex]::new('(?<s>' + (($strong | ForEach-Object { [regex]::Escape($_) }) -join '|') + ')|(?<=^|[^a-z0-9])(?<w>' + (($weak | ForEach-Object { [regex]::Escape($_) }) -join '|') + ')(?=[^a-z0-9]|$)', 'IgnoreCase')
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$hits = New-Object System.Collections.ArrayList
$notes = New-Object System.Collections.ArrayList
$stat = @{ Files = 0; Jars = 0; Denied = 0 }
function Add-TraceHit([string]$source, [string]$object, [string]$detail, [bool]$weak = $false) {
  [void]$hits.Add([pscustomobject]@{ Source = $source; Object = $object; Detail = $detail; Weak = $weak })
}
function Add-TraceNote([string]$text) {
  if (-not $notes.Contains($text)) { [void]$notes.Add($text) }
}
function Find-TraceName([string]$source, [string]$text, [string]$object, [string]$detail) {
  $best = $null
  foreach ($m in $rx.Matches(($text -replace '(?i)[\\/]Users[\\/][^\\/]+', '\Users\~'))) { if ($m.Groups['s'].Success) { $best = $m; break }; if (-not $best) { $best = $m } }
  if (-not $best) { return }
  $isWeak = -not $best.Groups['s'].Success
  $info = 'название ' + $best.Value.ToLower()
  if ($isWeak) { $info += ', общее слово или обычная программа: возможно ложное совпадение' }
  if ($detail) { $info += '; ' + $detail }
  if (-not $object) { $object = $text }
  Add-TraceHit $source $object $info $isWeak
}
function Write-TraceStep([string]$text) {
  Write-Host ('  > ' + $text) -ForegroundColor DarkGray
}
$owner = Get-CimInstance Win32_Process -Filter 'Name = ''explorer.exe''' | Select-Object -First 1 | Invoke-CimMethod -MethodName GetOwner
if ($owner.User -and $owner.User -ne $env:USERNAME) { Write-Host ('Команда запущена от имени ' + $env:USERNAME + ', а в Windows работает ' + $owner.User + ': папки и история ' + $owner.User + ' не проверяются. Запустите терминал из учётной записи игрока.') -ForegroundColor Yellow }
if (-not $admin) { Write-Host 'Без прав администратора часть источников недоступна; они перечислены в конце.' -ForegroundColor DarkYellow }
function Find-TraceFiles([string[]]$roots) {
  $stack = New-Object System.Collections.Stack
  foreach ($root in $roots) {
    if ($root -and (Test-Path -LiteralPath $root -PathType Container)) { $stack.Push($root); Write-Host ('    ' + $root) -ForegroundColor DarkGray }
  }
  $dirs = 0
  while ($stack.Count) {
    $dir = $stack.Pop()
    if ($dir -match '\\(WinSxS|servicing|\$Recycle\.Bin|System Volume Information|node_modules|\.git)$') { continue }
    $dirs++
    if (-not ($dirs -band 63)) { Write-Progress -Activity 'TRACE' -Status ('Файлов: ' + $stat.Files + ' · ' + $dir) }
    foreach ($item in @(Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue -ErrorVariable denied)) {
      if ($item.PSIsContainer) { if (-not ($item.Attributes -band 1024)) { $stack.Push($item.FullName) } } else { $stat.Files++ }
      Find-TraceName 'Файл' $item.Name $item.FullName ('изменён ' + $item.LastWriteTime.ToString('dd.MM.yyyy HH:mm'))
    }
    if ($denied) { $stat.Denied++ }
  }
  Write-Progress -Activity 'TRACE' -Completed
}
$downloads = $env:USERPROFILE + '\Downloads'
try { $shellDownloads = (New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path; if ($shellDownloads) { $downloads = $shellDownloads } } catch {}
$roots = @($downloads, [Environment]::GetFolderPath('Desktop'), $env:TEMP)
$steam = [string](Get-ItemProperty -LiteralPath 'HKCU:\Software\Valve\Steam').SteamPath
$libraries = @($steam)
$vdf = [string](Get-Content -LiteralPath ($steam + '\steamapps\libraryfolders.vdf') -Raw)
foreach ($m in [regex]::Matches($vdf, '\x22path\x22\s+\x22([^\x22]+)\x22')) { $libraries += $m.Groups[1].Value -replace '\\\\', '\' }
foreach ($lib in @($libraries | Where-Object { $_ } | Select-Object -Unique)) { foreach ($name in @('Counter-Strike Global Offensive')) { $roots += $lib + '\steamapps\common\' + $name } }
$cheatRoots = @(($env:APPDATA + '\OsirisCS2'), ($env:APPDATA + '\Neverlose'))
$roots += $cheatRoots
try {
  Write-TraceStep 'Процессы'
  try { $procs = @(Get-CimInstance Win32_Process -ErrorAction Stop) } catch { $procs = @(Get-Process | ForEach-Object { [pscustomobject]@{ Name = $_.ProcessName + '.exe'; ExecutablePath = $_.Path; ProcessId = $_.Id; CommandLine = '' } }); Add-TraceNote 'WMI не ответил: процессы взяты из Get-Process, без строк запуска.' }
  foreach ($p in $procs) {
    $object = [string]$p.ExecutablePath
    if (-not $object) { $object = [string]$p.Name }
    Find-TraceName 'Процесс' ([string]$p.Name + ' ' + $object) $object ('PID ' + $p.ProcessId)
  }
  foreach ($g in @(Get-Process -Name 'cs2' -ErrorAction SilentlyContinue)) {
    try { $mods = @($g.get_Modules()) } catch { Add-TraceNote ('DLL процесса ' + $g.Name + ' не прочитаны: процесс закрыт античитом или нужны права администратора.'); continue }
    foreach ($mod in $mods) {
      Find-TraceName ('DLL в ' + $g.Name) $mod.FileName $mod.FileName ('PID ' + $g.Id)
      if ($mod.FileName -match '\\(AppData\\Local\\Temp|Downloads)\\') { Add-TraceHit ('DLL в ' + $g.Name) $mod.FileName ('PID ' + $g.Id + '; загружена из Temp или «Загрузок»') }
    }
  }
  Write-TraceStep 'Prefetch'
  $mode = (Get-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters').EnablePrefetcher
  if ($mode -eq 0) { Add-TraceHit 'Prefetch' 'EnablePrefetcher = 0' 'запись Prefetch выключена в реестре' }
  try {
    $pf = @(Get-ChildItem -LiteralPath (Join-Path $env:WINDIR 'Prefetch') -Filter *.pf -ErrorAction Stop)
    if ($pf.Count -lt 30) { Add-TraceHit 'Prefetch' ('файлов: ' + $pf.Count) 'папка почти пуста: Prefetch могли очистить, проверьте время самого старого файла' }
    foreach ($f in $pf) { Find-TraceName 'Prefetch' $f.Name $f.Name ('последний запуск ' + $f.LastWriteTime.ToString('dd.MM.yyyy HH:mm')) }
  } catch {
    Add-TraceNote 'Prefetch не прочитан: нужны права администратора.'
  }
  Write-TraceStep 'Реестр'
  foreach ($base in 'HKLM:\SYSTEM\CurrentControlSet\Services\bam\State\UserSettings', 'HKLM:\SYSTEM\CurrentControlSet\Services\dam\State\UserSettings') {
    if (-not (Test-Path -LiteralPath $base)) { continue }
    try { $users = @(Get-ChildItem -LiteralPath $base -ErrorAction Stop) } catch { Add-TraceNote 'BAM не прочитан: нужны права администратора.'; continue }
    foreach ($key in $users) {
      $account = $key.PSChildName
      try { $account = (New-Object Security.Principal.SecurityIdentifier($key.PSChildName)).Translate([Security.Principal.NTAccount]).Value } catch {}
      foreach ($name in $key.GetValueNames()) {
        $value = $key.GetValue($name)
        $when = 'учётная запись ' + $account
        if ($value -is [byte[]] -and $value.Length -ge 8) { $when += ', запуск ' + [DateTime]::FromFileTime([BitConverter]::ToInt64($value, 0)).ToString('dd.MM.yyyy HH:mm') }
        Find-TraceName 'BAM' $name $name $when
      }
    }
  }
  $abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  $rot = 'NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm'
  foreach ($key in @(Get-ChildItem -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\UserAssist' -ErrorAction SilentlyContinue)) {
    $count = $key.OpenSubKey('Count')
    if (-not $count) { continue }
    foreach ($name in $count.GetValueNames()) {
      $plain = -join ($name.ToCharArray() | ForEach-Object { $i = $abc.IndexOf($_); if ($i -ge 0) { $rot[$i] } else { $_ } })
      Find-TraceName 'UserAssist' $plain $plain ''
    }
  }
  $run = Get-Item -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\RunMRU' -ErrorAction SilentlyContinue
  if ($run) {
    foreach ($name in $run.GetValueNames()) { if ($name -ne 'MRUList') { $value = [string]$run.GetValue($name); Find-TraceName 'Win+R' $value $value '' } }
  }
  foreach ($pair in @('AppCompat', 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Compatibility Assistant\Store'), @('MuiCache', 'HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\MuiCache')) {
    $key = Get-Item -LiteralPath $pair[1] -ErrorAction SilentlyContinue
    if (-not $key) { continue }
    foreach ($name in $key.GetValueNames()) { $exe = $name -replace '\.(FriendlyAppName|ApplicationCompany)$', ''; Find-TraceName $pair[0] $exe $exe 'запускался у этого пользователя' }
  }
  Write-TraceStep 'Корзина'
  try {
    $bin = (New-Object -ComObject Shell.Application).NameSpace(10)
    foreach ($item in @($bin.Items())) { Find-TraceName 'Корзина' $item.Name ($bin.GetDetailsOf($item, 1) + '\' + $item.Name) ('удалён ' + ($bin.GetDetailsOf($item, 2) -replace '[\u200e\u200f]', '')) }
  } catch {
    Add-TraceNote 'Корзина не прочитана.'
  }
  Write-TraceStep 'Defender'
  try {
    $mp = Get-MpPreference -ErrorAction Stop
    if ($admin) {
      foreach ($path in @($mp.ExclusionPath) + @($mp.ExclusionProcess) + @($mp.ExclusionExtension)) { if ($path -and $path -notlike 'N/A*') { Add-TraceHit 'Defender: исключение' $path 'это антивирус не проверяет; выясните, кто и зачем это добавил' } }
    } else {
      Add-TraceNote 'Исключения Defender видны только администратору.'
    }
    $status = Get-MpComputerStatus -ErrorAction SilentlyContinue
    if ($status.AMRunningMode -and $status.AMRunningMode -ne 'Normal') { Add-TraceNote ('Defender в режиме ' + $status.AMRunningMode + ': компьютер защищает другой антивирус.') } elseif ($status -and -not $status.RealTimeProtectionEnabled) { Add-TraceHit 'Defender' 'Защита в реальном времени выключена' 'выясните, кто и когда её выключил' }
  } catch {
    Add-TraceNote 'Defender не ответил: возможно, его заменяет другой антивирус.'
  }
  Write-TraceStep 'Автозапуск'
  foreach ($task in @(Get-ScheduledTask -ErrorAction SilentlyContinue)) {
    foreach ($action in @($task.Actions)) { $run = [string]$action.Execute + ' ' + [string]$action.Arguments; Find-TraceName 'Планировщик' ($task.TaskName + ' ' + $run) ($task.TaskPath + $task.TaskName + ': ' + $run) '' }
  }
  foreach ($path in 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run') {
    $key = Get-Item -LiteralPath $path -ErrorAction SilentlyContinue
    if ($key) { foreach ($name in $key.GetValueNames()) { $value = [string]$key.GetValue($name); Find-TraceName 'Run' ($name + ' ' + $value) $value $name } }
  }
  foreach ($dir in [Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('CommonStartup')) {
    foreach ($f in @(Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue)) { Find-TraceName 'Автозагрузка' $f.Name $f.FullName '' }
  }
  Write-TraceStep 'Службы и журналы'
  foreach ($name in 'PcaSvc', 'SysMain', 'DPS', 'EventLog') {
    $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
    if (-not $svc) { Add-TraceHit 'Служба' $name 'не найдена'; continue }
    if ($svc.Status -ne 'Running' -or $svc.StartType -eq 'Disabled') { Add-TraceHit 'Служба' $name ('состояние ' + $svc.Status + ', запуск ' + $svc.StartType + '; остановка сама по себе не доказывает вмешательство') }
  }
  if (-not $admin) { Add-TraceNote 'Журнал Security виден только администратору.' }
  foreach ($query in @{ LogName = 'Security'; Id = 1102 }, @{ LogName = 'System'; Id = 104 }) {
    foreach ($e in @(Get-WinEvent -FilterHashtable $query -MaxEvents 5 -ErrorAction SilentlyContinue)) { Add-TraceHit 'Журнал очищен' ($query.LogName + ', событие ' + $query.Id) ($e.TimeCreated.ToString('dd.MM.yyyy HH:mm') + '; очистку мог сделать и администратор') }
  }
  Write-TraceStep 'hosts'
  foreach ($line in @(Get-Content -LiteralPath (Join-Path $env:WINDIR 'System32\drivers\etc\hosts') -ErrorAction SilentlyContinue)) {
    $line = $line.Trim()
    if ($line -and -not $line.StartsWith('#') -and $line -notmatch '\slocalhost$') { Add-TraceHit 'hosts' $line 'адрес перенаправлен; проверьте, чей это домен' }
  }
  Write-TraceStep 'Папки игры'
  foreach ($dir in $cheatRoots) { if (Test-Path -LiteralPath $dir) { Add-TraceHit 'Папка' $dir 'папка программы из списка; посмотрите, что в ней' } }
  Find-TraceFiles $roots
} finally {
  Write-Progress -Activity 'TRACE' -Completed
  Write-Host ''
  $found = @($hits | Sort-Object Source, Object, Detail -Unique | Sort-Object Weak, Source, Object)
  if ($found.Count) {
    foreach ($hit in @($found | Select-Object -First 300)) {
      Write-Host ('[' + $hit.Source + '] ' + $hit.Object) -ForegroundColor White
      Write-Host ('    ' + $hit.Detail) -ForegroundColor DarkGray
    }
    Write-Host ''
    Write-Host ('Найдено: ' + $found.Count) -ForegroundColor Yellow
    if ($found.Count -gt 300) { Write-Host 'Показаны первые 300. Выберите задачу поуже.' -ForegroundColor Yellow }
  } else {
    Write-Host 'Ничего не найдено.' -ForegroundColor Green
  }
  if ($stat.Files) { Write-Host ('Файлов просмотрено: ' + $stat.Files) -ForegroundColor DarkGray }
  if ($stat.Jars) { Write-Host ('JAR открыто: ' + $stat.Jars) -ForegroundColor DarkGray }
  if ($stat.Denied) { Add-TraceNote ('папок, которые не открылись: ' + $stat.Denied + '; их содержимое не проверено.') }
  foreach ($note in $notes) { Write-Host ('Не проверено: ' + $note) -ForegroundColor DarkYellow }
  Write-Host 'Совпадение — повод разобраться, а не доказательство. Пустой результат не доказывает, что ПК чист.' -ForegroundColor DarkGray
}
