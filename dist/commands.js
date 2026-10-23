'use strict';
/* TRACE commands. One set of PowerShell blocks builds every command on check.html: the PowerShell tab shows them
   as a readable script; the CMD tab joins the same lines into one `powershell -NoProfile -Command "…"` line,
   because cmd.exe runs every pasted line on its own. That is why the blocks have no comments, no double quotes,
   no % and no multi-line ( … ): each of those breaks either cmd.exe or the joined line.
   The page loads this file as a plain script; src/site.mjs and scripts/verify-commands.mjs run it in node:vm to
   write the per-game .ps1 files and to parse every command. Minecraft names come from trace-pro-minecraft.ps1
   through dist/minecraft-command.js (window.TraceMinecraftCommands), so the page and TRACE-PRO search the same list. */
(() => {
  const root = typeof window === 'undefined' ? globalThis : window;
  const pro = () => root.TraceMinecraftCommands;

  const asciiTrace = [
    '████████╗██████╗  █████╗  ██████╗███████╗',
    '╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██╔════╝',
    '   ██║   ██████╔╝███████║██║     █████╗  ',
    '   ██║   ██╔══██╗██╔══██║██║     ██╔══╝  ',
    '   ██║   ██║  ██║██║  ██║╚██████╗███████╗',
    '   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝'
  ];

  const q = text => `'${String(text).replaceAll("'", "''")}'`;
  const list = items => items.map(q).join(', ');
  const user = String.raw`($env:USERPROFILE + '\Downloads')`;
  const shared = [user, `[Environment]::GetFolderPath('Desktop')`, '$env:TEMP'];
  const steam = name => String.raw`($steam + '\steamapps\common\${name}')`;

  /* What each task reads. `admin` marks tasks that see less without administrator rights. */
  const tasks = {
    all: {title: 'Всё сразу', note: 'все источники ниже, кроме дисков', admin: true},
    processes: {title: 'Процессы', note: 'запущенные программы и DLL в игре'},
    prefetch: {title: 'Prefetch', note: 'какие EXE запускались', admin: true},
    registry: {title: 'Реестр', note: 'BAM, UserAssist, Win+R, MuiCache', admin: true},
    recycle: {title: 'Корзина', note: 'имена удалённых файлов'},
    defender: {title: 'Defender', note: 'исключения антивируса', admin: true},
    autostart: {title: 'Автозапуск', note: 'планировщик, Run, автозагрузка'},
    services: {title: 'Службы и журналы', note: 'остановленные службы, очистка журналов', admin: true},
    hosts: {title: 'hosts', note: 'перенаправленные адреса'},
    folders: {title: 'Папки игры', note: 'имена файлов, «Загрузки», рабочий стол'},
    jar: {title: 'Классы в JAR', note: 'имена пакетов внутри модов'},
    drives: {title: 'Все диски', note: 'имена файлов, долго'}
  };

  /* What a task does, in one line on the page. */
  const about = {
    all: 'Проходит по всем источникам ниже, кроме полного обхода дисков, и выводит один общий список.',
    processes: 'Имена и пути запущенных программ и DLL, загруженные в процесс игры. DLL из Temp и «Загрузок» показываются всегда.',
    prefetch: 'Windows записывает в Prefetch, какие EXE запускались и когда. Команда ищет известные названия среди этих записей и замечает выключенный или почти пустой Prefetch. Нужны права администратора.',
    registry: 'История запусков из реестра: BAM (с временем запуска), UserAssist, окно «Выполнить» (Win+R), Compatibility Assistant и MuiCache. BAM читается только с правами администратора.',
    recycle: 'Имена файлов в корзине, их исходные папки и дата удаления.',
    defender: 'Все папки и процессы, исключённые из проверки Microsoft Defender, и выключенная защита в реальном времени. Исключения видны только администратору.',
    autostart: 'Задания планировщика, разделы Run в реестре и папки автозагрузки.',
    services: 'Остановленные или выключенные PcaSvc, SysMain, DPS и EventLog и записи об очистке журналов Windows. Журнал Security виден только администратору.',
    hosts: 'Все действующие строки файла hosts: перенаправленный адрес может отрезать игру или античит от сервера.',
    folders: 'Имена файлов и папок в папках игры и лаунчеров, в «Загрузках», на рабочем столе и во временной папке.',
    jar: 'Открывает каждый JAR в папках лаунчеров и ищет известные имена пакетов среди классов. Поведение программы не анализируется.',
    drives: 'Имена файлов на всех локальных дисках. Может занять долго; остановить можно Ctrl+C.'
  };

  const games = {
    minecraft: {
      label: 'Minecraft',
      tasks: ['all', 'processes', 'prefetch', 'registry', 'recycle', 'defender', 'autostart', 'services', 'hosts', 'folders', 'jar', 'drives'],
      terms: () => pro().keywords,
      weak: () => pro().weakKeywords,
      jar: () => pro().jarSignatures,
      roots: () => [...pro().gameRoots.filter(path => !/Downloads|Temp/.test(path)), ...shared],
      modules: ['java', 'javaw'],
      source: 'Список из сценария TRACE-PRO: клиенты для анархий, ghost-клиенты, автокликеры и программы для очистки следов.'
    },
    gta: {
      label: 'GTA V RP',
      tasks: ['all', 'processes', 'prefetch', 'registry', 'recycle', 'defender', 'autostart', 'services', 'hosts', 'folders', 'drives'],
      // FiveM menus as anticheat vendors list them (2026), GTA Online menus, and names sellers give to GTA5RP and
      // Majestic products. Single common words are marked weak: their hits are shown as possibly false.
      terms: () => ['eulen', 'redengine', 'susano', 'phaze', 'skript.gg', 'skriptgg', 'hx software', 'hxsoftware', 'tz project', 'tzproject', 'keyser', 'kaizer', 'tartar', 'lumia menu', 'vortex menu', 'pulse menu', '2take1', 'cherax', 'yimmenu', 'kiddion', 'modest-menu', 'stand launchpad', 'mason-gta', 'mason cheat', 'nightfall', 'smg-gta', 'smg_cheat', 'smg majestic'],
      weak: () => ['nightfall', 'keyser', 'kaizer', 'tartar', 'phaze'],
      roots: () => [String.raw`($env:LOCALAPPDATA + '\FiveM')`, String.raw`($env:LOCALAPPDATA + '\GTA5RP')`, String.raw`($env:LOCALAPPDATA + '\Majestic')`, String.raw`($env:APPDATA + '\Majestic')`, String.raw`($env:APPDATA + '\Stand')`, String.raw`($env:SystemDrive + '\RAGEMP')`, String.raw`(Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\WOW6432Node\Rockstar Games\Grand Theft Auto V' -ErrorAction SilentlyContinue).InstallFolder`, steam('Grand Theft Auto V'), ...shared],
      modules: ['GTA5', 'GTA5_Enhanced', 'FiveM*'],
      steam: true,
      source: 'Меню для FiveM из списков античитов (Eulen, RedEngine, Susano, Skript.gg, HX, TZ Project и другие), меню для GTA Online и названия, под которыми продают читы для GTA5RP и Majestic.'
    },
    cs2: {
      label: 'Counter-Strike 2',
      tasks: ['all', 'processes', 'prefetch', 'registry', 'recycle', 'defender', 'autostart', 'services', 'hosts', 'folders', 'drives'],
      terms: () => ['neverlose', 'aimware', 'memesense', 'nixware', 'midnight.im', 'osiris', 'osiriscs2'],
      weak: () => ['osiris'],
      roots: () => [String.raw`($env:APPDATA + '\OsirisCS2')`, String.raw`($env:APPDATA + '\Neverlose')`, steam('Counter-Strike Global Offensive'), ...shared],
      modules: ['cs2'],
      steam: true,
      source: 'Платные и открытые читы, у которых есть версия для CS2. Переименованный файл или чит внутри другого процесса поиск по имени не найдёт; это не замена VAC.'
    }
  };

  /* ───── Blocks ───── */
  const core = game => [
    `$ErrorActionPreference = 'SilentlyContinue'`,
    `$terms = @(${list(game.terms())})`,
    `$weak = @(${list(game.weak())})`,
    String.raw`$rx = [regex]::new('(?<![a-z0-9])(' + (($terms | ForEach-Object { [regex]::Escape($_) }) -join '|') + ')(?![a-z0-9])', 'IgnoreCase')`,
    `$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)`,
    `$hits = New-Object System.Collections.ArrayList`,
    `$notes = New-Object System.Collections.ArrayList`,
    `$stat = @{ Files = 0; Jars = 0 }`,
    `function Add-TraceHit([string]$source, [string]$object, [string]$detail) {`,
    `  [void]$hits.Add([pscustomobject]@{ Source = $source; Object = $object; Detail = $detail })`,
    `}`,
    `function Add-TraceNote([string]$text) {`,
    `  if (-not $notes.Contains($text)) { [void]$notes.Add($text) }`,
    `}`,
    `function Find-TraceName([string]$source, [string]$text, [string]$object, [string]$detail) {`,
    `  $match = $rx.Match($text)`,
    `  if (-not $match.Success) { return }`,
    `  $word = $match.Groups[1].Value.ToLower()`,
    `  $info = 'название ' + $word`,
    `  if ($weak -contains $word) { $info += ', общее слово: возможно ложное совпадение' }`,
    `  if ($detail) { $info += '; ' + $detail }`,
    `  if (-not $object) { $object = $text }`,
    `  Add-TraceHit $source $object $info`,
    `}`,
    `function Write-TraceStep([string]$text) {`,
    `  Write-Host ('  > ' + $text) -ForegroundColor DarkGray`,
    `}`
  ];

  // Walks folders without following links; a stack instead of -Recurse lets it skip system stores and junction loops.
  const walker = [
    `function Find-TraceFiles([string[]]$roots) {`,
    `  $stack = New-Object System.Collections.Stack`,
    `  foreach ($root in $roots) {`,
    `    if ($root -and (Test-Path -LiteralPath $root -PathType Container)) { $stack.Push($root); Write-Host ('    ' + $root) -ForegroundColor DarkGray }`,
    `  }`,
    `  $dirs = 0`,
    `  while ($stack.Count) {`,
    `    $dir = $stack.Pop()`,
    String.raw`    if ($dir -match '\\(WinSxS|servicing|\$Recycle\.Bin|System Volume Information|node_modules|\.git)$') { continue }`,
    `    $dirs++`,
    `    if (-not ($dirs -band 63)) { Write-Progress -Activity 'TRACE' -Status ('Файлов: ' + $stat.Files + ' · ' + $dir) }`,
    `    foreach ($item in @(Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue)) {`,
    `      if ($item.PSIsContainer) { if (-not ($item.Attributes -band 1024)) { $stack.Push($item.FullName) } } else { $stat.Files++ }`,
    `      Find-TraceName 'Файл' $item.Name $item.FullName ('изменён ' + $item.LastWriteTime.ToString('dd.MM.yyyy HH:mm'))`,
    `    }`,
    `  }`,
    `  Write-Progress -Activity 'TRACE' -Completed`,
    `}`
  ];

  const jarCheck = game => [
    `Add-Type -AssemblyName System.IO.Compression.FileSystem`,
    `$signatures = @(${list(game.jar())})`,
    String.raw`$sig = [regex]::new('(^|/)(' + (($signatures | ForEach-Object { [regex]::Escape($_) }) -join '|') + ')(/|\$|\.class$)', 'IgnoreCase')`,
    `function Find-TraceJar($file) {`,
    `  if ($file.Length -gt 268435456) { Add-TraceNote ('JAR больше 256 МБ пропущен: ' + $file.FullName); return }`,
    `  try { $zip = [IO.Compression.ZipFile]::OpenRead($file.FullName) } catch { Add-TraceNote ('JAR не прочитан: ' + $file.FullName); return }`,
    `  $stat.Jars++`,
    `  try {`,
    `    foreach ($entry in $zip.Entries) {`,
    `      if ($entry.FullName -like '*.class' -and $sig.IsMatch($entry.FullName)) { Add-TraceHit 'Класс в JAR' $file.FullName ('запись ' + $entry.FullName + '; проверяются имена классов, а не поведение'); break }`,
    `    }`,
    `  } finally {`,
    `    $zip.Dispose()`,
    `  }`,
    `}`
  ];

  const roots = game => [
    ...(game.steam ? [`$steam = [string](Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Valve\\Steam' -ErrorAction SilentlyContinue).SteamPath`] : []),
    `$roots = @(${game.roots().join(', ')})`
  ];

  const steps = {
    processes: game => [
      `Write-TraceStep 'Процессы'`,
      `foreach ($p in @(Get-CimInstance Win32_Process)) {`,
      `  $object = [string]$p.ExecutablePath`,
      `  if (-not $object) { $object = [string]$p.Name }`,
      `  Find-TraceName 'Процесс' ([string]$p.Name + ' ' + $object) $object ('PID ' + $p.ProcessId)`,
      ...(game === games.minecraft ? [
        `  if ($p.Name -like 'java*') {`,
        `    $line = [string]$p.CommandLine`,
        String.raw`    foreach ($agent in [regex]::Matches($line, '-javaagent:(\x22[^\x22]+\x22|\S+)')) { Add-TraceHit 'Java: -javaagent' $agent.Groups[1].Value ('PID ' + $p.ProcessId + '; агент встраивается в игру, проверьте этот файл') }`,
        String.raw`    if ($line -match '\s(-noverify|-Xbootclasspath\S*)') { Add-TraceHit 'Java: аргумент' $Matches[1] ('PID ' + $p.ProcessId + '; отключает проверку классов или подменяет их') }`,
        `    foreach ($word in $rx.Matches($line)) { Add-TraceHit 'Java: строка запуска' $word.Groups[1].Value ('PID ' + $p.ProcessId) }`,
        `  }`
      ] : []),
      `}`,
      `foreach ($g in @(Get-Process -Name ${list(game.modules)} -ErrorAction SilentlyContinue)) {`,
      `  try { $mods = @($g.Modules) } catch { Add-TraceNote ('DLL процесса ' + $g.Name + ' не прочитаны: нужны права администратора.'); continue }`,
      `  foreach ($mod in $mods) {`,
      `    Find-TraceName ('DLL в ' + $g.Name) $mod.ModuleName $mod.FileName ('PID ' + $g.Id)`,
      String.raw`    if ($mod.FileName -match '\\(AppData\\Local\\Temp|Downloads)\\') { Add-TraceHit ('DLL в ' + $g.Name) $mod.FileName ('PID ' + $g.Id + '; загружена из Temp или «Загрузок»') }`,
      `  }`,
      `}`
    ],
    prefetch: () => [
      `Write-TraceStep 'Prefetch'`,
      String.raw`$mode = (Get-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters').EnablePrefetcher`,
      `if ($mode -eq 0) { Add-TraceHit 'Prefetch' 'EnablePrefetcher = 0' 'запись Prefetch выключена в реестре' }`,
      `try {`,
      `  $pf = @(Get-ChildItem -LiteralPath (Join-Path $env:WINDIR 'Prefetch') -Filter *.pf -ErrorAction Stop)`,
      `  if ($pf.Count -lt 30) { Add-TraceHit 'Prefetch' ('файлов: ' + $pf.Count) 'папка почти пуста: Prefetch могли очистить, проверьте время самого старого файла' }`,
      `  foreach ($f in $pf) { Find-TraceName 'Prefetch' $f.Name $f.Name ('последний запуск ' + $f.LastWriteTime.ToString('dd.MM.yyyy HH:mm')) }`,
      `} catch {`,
      `  Add-TraceNote 'Prefetch не прочитан: нужны права администратора.'`,
      `}`
    ],
    registry: () => [
      `Write-TraceStep 'Реестр'`,
      String.raw`foreach ($base in 'HKLM:\SYSTEM\CurrentControlSet\Services\bam\State\UserSettings', 'HKLM:\SYSTEM\CurrentControlSet\Services\dam\State\UserSettings') {`,
      `  try { $users = @(Get-ChildItem -LiteralPath $base -ErrorAction Stop) } catch { Add-TraceNote 'BAM не прочитан: нужны права администратора.'; continue }`,
      `  foreach ($key in $users) {`,
      `    foreach ($name in $key.GetValueNames()) {`,
      `      $value = $key.GetValue($name)`,
      `      $when = ''`,
      `      if ($value -is [byte[]] -and $value.Length -ge 8) { $when = 'запуск ' + [DateTime]::FromFileTime([BitConverter]::ToInt64($value, 0)).ToString('dd.MM.yyyy HH:mm') }`,
      `      Find-TraceName 'BAM' $name $name $when`,
      `    }`,
      `  }`,
      `}`,
      `$abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'`,
      `$rot = 'NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm'`,
      String.raw`foreach ($key in @(Get-ChildItem -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\UserAssist' -ErrorAction SilentlyContinue)) {`,
      `  $count = $key.OpenSubKey('Count')`,
      `  if (-not $count) { continue }`,
      `  foreach ($name in $count.GetValueNames()) {`,
      `    $plain = -join ($name.ToCharArray() | ForEach-Object { $i = $abc.IndexOf($_); if ($i -ge 0) { $rot[$i] } else { $_ } })`,
      `    Find-TraceName 'UserAssist' $plain $plain ''`,
      `  }`,
      `}`,
      String.raw`$run = Get-Item -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\RunMRU' -ErrorAction SilentlyContinue`,
      `if ($run) {`,
      `  foreach ($name in $run.GetValueNames()) { if ($name -ne 'MRUList') { $value = [string]$run.GetValue($name); Find-TraceName 'Win+R' $value $value '' } }`,
      `}`,
      String.raw`foreach ($pair in @('AppCompat', 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Compatibility Assistant\Store'), @('MuiCache', 'HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\MuiCache')) {`,
      `  $key = Get-Item -LiteralPath $pair[1] -ErrorAction SilentlyContinue`,
      `  if (-not $key) { continue }`,
      String.raw`  foreach ($name in $key.GetValueNames()) { $exe = $name -replace '\.(FriendlyAppName|ApplicationCompany)$', ''; Find-TraceName $pair[0] $exe $exe 'запускался у этого пользователя' }`,
      `}`
    ],
    recycle: () => [
      `Write-TraceStep 'Корзина'`,
      `try {`,
      `  $bin = (New-Object -ComObject Shell.Application).NameSpace(10)`,
      String.raw`  foreach ($item in @($bin.Items())) { Find-TraceName 'Корзина' $item.Name ($bin.GetDetailsOf($item, 1) + '\' + $item.Name) ('удалён ' + $bin.GetDetailsOf($item, 2)) }`,
      `} catch {`,
      `  Add-TraceNote 'Корзина не прочитана.'`,
      `}`
    ],
    defender: () => [
      `Write-TraceStep 'Defender'`,
      `try {`,
      `  $mp = Get-MpPreference -ErrorAction Stop`,
      `  foreach ($path in @($mp.ExclusionPath) + @($mp.ExclusionProcess)) {`,
      `    if (-not $path) { continue }`,
      `    if ($path -like 'N/A*') { Add-TraceNote 'Исключения Defender видны только администратору.'; continue }`,
      `    Add-TraceHit 'Defender: исключение' $path 'этот путь антивирус не проверяет; выясните, кто и зачем его добавил'`,
      `  }`,
      `  $status = Get-MpComputerStatus -ErrorAction SilentlyContinue`,
      `  if ($status -and -not $status.RealTimeProtectionEnabled) { Add-TraceHit 'Defender' 'Защита в реальном времени выключена' 'если стоит другой антивирус, это нормально' }`,
      `} catch {`,
      `  Add-TraceNote 'Defender не ответил: возможно, его заменяет другой антивирус.'`,
      `}`
    ],
    autostart: () => [
      `Write-TraceStep 'Автозапуск'`,
      `foreach ($task in @(Get-ScheduledTask -ErrorAction SilentlyContinue)) {`,
      `  foreach ($action in @($task.Actions)) { $run = [string]$action.Execute + ' ' + [string]$action.Arguments; Find-TraceName 'Планировщик' ($task.TaskName + ' ' + $run) ($task.TaskPath + $task.TaskName + ': ' + $run) '' }`,
      `}`,
      String.raw`foreach ($path in 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run') {`,
      `  $key = Get-Item -LiteralPath $path -ErrorAction SilentlyContinue`,
      `  if ($key) { foreach ($name in $key.GetValueNames()) { $value = [string]$key.GetValue($name); Find-TraceName 'Run' ($name + ' ' + $value) $value $name } }`,
      `}`,
      `foreach ($dir in [Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('CommonStartup')) {`,
      `  foreach ($f in @(Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue)) { Find-TraceName 'Автозагрузка' $f.Name $f.FullName '' }`,
      `}`
    ],
    services: () => [
      `Write-TraceStep 'Службы и журналы'`,
      `foreach ($name in 'PcaSvc', 'SysMain', 'DPS', 'EventLog') {`,
      `  $svc = Get-Service -Name $name -ErrorAction SilentlyContinue`,
      `  if (-not $svc) { Add-TraceHit 'Служба' $name 'не найдена'; continue }`,
      `  if ($svc.Status -ne 'Running' -or $svc.StartType -eq 'Disabled') { Add-TraceHit 'Служба' $name ('состояние ' + $svc.Status + ', запуск ' + $svc.StartType + '; остановка сама по себе не доказывает вмешательство') }`,
      `}`,
      `if (-not $admin) { Add-TraceNote 'Журнал Security виден только администратору.' }`,
      `foreach ($query in @{ LogName = 'Security'; Id = 1102 }, @{ LogName = 'System'; Id = 104 }) {`,
      `  foreach ($e in @(Get-WinEvent -FilterHashtable $query -MaxEvents 5 -ErrorAction SilentlyContinue)) { Add-TraceHit 'Журнал очищен' ($query.LogName + ', событие ' + $query.Id) ($e.TimeCreated.ToString('dd.MM.yyyy HH:mm') + '; очистку мог сделать и администратор') }`,
      `}`
    ],
    hosts: () => [
      `Write-TraceStep 'hosts'`,
      String.raw`foreach ($line in @(Get-Content -LiteralPath (Join-Path $env:WINDIR 'System32\drivers\etc\hosts') -ErrorAction SilentlyContinue)) {`,
      `  $line = $line.Trim()`,
      String.raw`  if ($line -and -not $line.StartsWith('#') -and $line -notmatch '\slocalhost$') { Add-TraceHit 'hosts' $line 'адрес перенаправлен; проверьте, чей это домен' }`,
      `}`
    ],
    folders: () => [
      `Write-TraceStep 'Папки игры'`,
      `Find-TraceFiles $roots`
    ],
    jar: () => [
      `Write-TraceStep 'Классы в JAR'`,
      `foreach ($root in $roots) {`,
      `  if ($root -and (Test-Path -LiteralPath $root -PathType Container)) { foreach ($file in @(Get-ChildItem -LiteralPath $root -Filter *.jar -File -Recurse -Force -ErrorAction SilentlyContinue)) { Find-TraceJar $file } }`,
      `}`
    ],
    drives: () => [
      `Write-TraceStep 'Все локальные диски. Это долго; остановить можно Ctrl+C'`,
      String.raw`Find-TraceFiles @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object { $_.DeviceID + '\' })`
    ]
  };

  const report = [
    `Write-Host ''`,
    `$found = @($hits | Sort-Object Source, Object -Unique)`,
    `if ($found.Count) {`,
    `  foreach ($hit in @($found | Select-Object -First 300)) {`,
    `    Write-Host ('[' + $hit.Source + '] ' + $hit.Object) -ForegroundColor White`,
    `    Write-Host ('    ' + $hit.Detail) -ForegroundColor DarkGray`,
    `  }`,
    `  Write-Host ''`,
    `  Write-Host ('Найдено: ' + $found.Count) -ForegroundColor Yellow`,
    `  if ($found.Count -gt 300) { Write-Host 'Показаны первые 300. Выберите задачу поуже.' -ForegroundColor Yellow }`,
    `} else {`,
    `  Write-Host 'Ничего не найдено.' -ForegroundColor Green`,
    `}`,
    `if ($stat.Files) { Write-Host ('Файлов просмотрено: ' + $stat.Files) -ForegroundColor DarkGray }`,
    `if ($stat.Jars) { Write-Host ('JAR открыто: ' + $stat.Jars) -ForegroundColor DarkGray }`,
    `foreach ($note in $notes) { Write-Host ('Не проверено: ' + $note) -ForegroundColor DarkYellow }`,
    `Write-Host 'Совпадение — повод разобраться, а не доказательство. Пустой результат не доказывает, что ПК чист.' -ForegroundColor DarkGray`
  ];

  const art = () => [
    `$art = @(`,
    ...asciiTrace.map((line, i) => q(line) + (i < asciiTrace.length - 1 ? ',' : '')),
    `)`,
    `foreach ($line in $art) { Write-Host ('  ' + $line) -ForegroundColor Gray }`,
    `Write-Host ''`
  ];

  // The task's own lines, wrapped in what every command shares.
  function taskLines(gameKey, taskKey, withIntro) {
    const game = games[gameKey], task = tasks[taskKey];
    const parts = taskKey === 'all' ? game.tasks.filter(key => key !== 'all' && key !== 'drives') : [taskKey];
    const needsRoots = parts.some(key => key === 'folders' || key === 'jar');
    const needsWalker = parts.some(key => key === 'folders' || key === 'drives');
    return [
      ...(withIntro ? art() : []),
      `Write-Host ('TRACE · ${game.label} · ${task.title} · ' + (Get-Date).ToString('dd.MM.yyyy HH:mm')) -ForegroundColor White`,
      ...core(game),
      ...(task.admin ? [`if (-not $admin) { Write-Host 'Без прав администратора часть источников недоступна; они перечислены в конце.' -ForegroundColor DarkYellow }`] : []),
      ...(parts.includes('jar') ? jarCheck(game) : []),
      ...(needsWalker ? walker : []),
      ...(needsRoots ? roots(game) : []),
      ...parts.flatMap(key => steps[key](game)),
      ...report
    ];
  }

  // Indents a block of lines by its braces and by arrays left open at the end of a line, for the PowerShell tab
  // and the .ps1 files.
  function indent(lines, base = '') {
    let depth = 0;
    return lines.map(line => {
      const text = line.trim(), closes = /^[})]/.test(text);
      const out = base + '  '.repeat(Math.max(0, depth - (closes ? 1 : 0))) + text;
      depth += (text.match(/{/g) || []).length - (text.match(/}/g) || []).length + (text.endsWith('(') ? 1 : 0) - (text.startsWith(')') ? 1 : 0);
      depth = Math.max(0, depth);
      return out;
    });
  }

  // Joins lines into one PowerShell line. After an opening bracket, a comma or a pipe the line goes on, and so it
  // does before a closing bracket or else/elseif/catch/finally; anywhere else a statement ends and gets a semicolon.
  function oneLine(lines) {
    const clean = lines.map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    return clean.reduce((out, line, i) => {
      if (!i) return line;
      const glue = /[{(,|]$/.test(out) || /^([})]|(else|elseif|catch|finally)\b)/.test(line) ? ' ' : '; ';
      return out + glue + line;
    }, '');
  }

  function minecraftAll(withIntro) {
    return `& {\r\n  $SkipIntro = $${withIntro ? 'false' : 'true'}\r\n  $AnimationOnly = $false\r\n  $Preset = 'minecraft'\r\n${pro()[withIntro ? 'full' : 'compact']}\r\n}`;
  }

  function command(gameKey, method, taskKey, withIntro = true) {
    if (!games[gameKey] || !tasks[taskKey] || !games[gameKey].tasks.includes(taskKey)) throw new Error(`Unknown command ${gameKey}/${taskKey}`);
    // TRACE-PRO is the whole check for Minecraft in PowerShell; it is too long for one cmd.exe line (8191 characters).
    if (gameKey === 'minecraft' && taskKey === 'all' && method === 'powershell') return minecraftAll(withIntro);
    const lines = taskLines(gameKey, taskKey, withIntro);
    if (method === 'cmd') {
      if (taskKey === 'all') return cmdFile(gameKey, withIntro);
      return `powershell -NoProfile -Command "${oneLine(lines)}"`;
    }
    return ['& {', ...indent(lines, '  '), '}'].join('\r\n');
  }

  // The whole check does not fit into one cmd.exe line, so in CMD it runs the downloaded file of the same check.
  const fileFor = gameKey => gameKey === 'minecraft' ? 'trace-pro-minecraft.ps1' : `trace-${gameKey}.ps1`;
  function cmdFile(gameKey, withIntro) {
    const extra = gameKey === 'minecraft' ? ` -Preset minecraft${withIntro ? '' : ' -SkipIntro'}` : withIntro ? '' : ' -SkipIntro';
    return `powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\\Downloads\\${fileFor(gameKey)}"${extra}`;
  }

  // The downloadable whole check for GTA V RP and CS2: the same blocks as the "all" command, as a script file.
  function scriptFile(gameKey) {
    const head = [
      '#requires -Version 5.1',
      `# TRACE: локальная проверка ${games[gameKey].label}. Только чтение: ничего не удаляет и не отправляет в сеть.`,
      `# Запуск: powershell -NoProfile -ExecutionPolicy Bypass -File .\\${fileFor(gameKey)}   (-SkipIntro убирает заставку)`,
      '[CmdletBinding()]',
      'param([switch]$SkipIntro)'
    ];
    const body = taskLines(gameKey, 'all', false);
    return [...head, '', 'if (-not $SkipIntro) {', ...indent(art(), '  '), '}', ...indent(body), ''].join('\r\n');
  }

  root.TraceCommands = {games, tasks, about, asciiTrace, command, oneLine, scriptFile, fileFor};
})();
