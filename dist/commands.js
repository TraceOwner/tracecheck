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
  const shared = ['$downloads', `[Environment]::GetFolderPath('Desktop')`, '$env:TEMP'];

  /* What each task reads. `admin` marks tasks that see less without administrator rights. */
  const tasks = {
    all: {title: 'Всё сразу', note: 'все задачи, кроме «Все диски»', admin: true},
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
    drives: {title: 'Все диски', note: 'имена файлов на дисках и флешках', admin: true}
  };

  /* What a task does, in one line on the page. */
  const about = {
    all: 'Проходит по всем задачам из списка, кроме «Все диски», и выводит один общий список.',
    processes: 'Имена и пути запущенных программ и DLL, загруженные в процесс игры. DLL из Temp и «Загрузок» показываются всегда. Процесс, закрытый античитом, команда перечислит в конце.',
    prefetch: 'Windows записывает в Prefetch, какие EXE запускались и когда. Команда ищет известные названия среди этих записей и замечает выключенный или почти пустой Prefetch. Нужны права администратора.',
    registry: 'История запусков из реестра: BAM (время запуска и учётная запись), UserAssist, окно «Выполнить» (Win+R), Compatibility Assistant и MuiCache. BAM читается только с правами администратора.',
    recycle: 'Имена файлов в корзине, их исходные папки и дата удаления.',
    defender: 'Все папки, процессы и расширения, исключённые из проверки Microsoft Defender, и выключенная защита в реальном времени. Исключения видны только администратору.',
    autostart: 'Задания планировщика, разделы Run в реестре и папки автозагрузки.',
    services: 'Остановленные или выключенные PcaSvc, SysMain, DPS и EventLog и записи об очистке журналов Windows. Журнал Security виден только администратору.',
    hosts: 'Все действующие строки файла hosts: перенаправленный адрес может отрезать игру или античит от сервера.',
    folders: 'Имена файлов и папок в папках игры и лаунчеров, в «Загрузках», на рабочем столе и во временной папке. Если есть папка самого чита из списка, она тоже попадёт в список.',
    jar: 'Открывает каждый JAR в папках лаунчеров и ищет известные пакеты, то есть папки внутри архива вроде ru/nursultan. Поведение программы не анализируется.',
    drives: 'Имена файлов на всех дисках и флешках. Может занять долго; остановить можно Ctrl+C, найденное к этому моменту команда покажет.'
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
      source: 'Список из сценария TRACE-PRO: клиенты для анархий, ghost-клиенты, автокликеры, программы для очистки следов и спуферы.'
    },
    gta: {
      label: 'GTA V RP',
      tasks: ['all', 'processes', 'prefetch', 'registry', 'recycle', 'defender', 'autostart', 'services', 'hosts', 'folders', 'drives'],
      // FiveM menus as anticheat vendors list them (2026), GTA Online menus, and names sellers give to GTA5RP and
      // Majestic products. Single common words are marked weak: their hits are shown as possibly false.
      terms: () => ['eulen', 'redengine', 'susano', 'phaze', 'skript.gg', 'skriptgg', 'hx software', 'hxsoftware', 'tz project', 'tzproject', 'keyser', 'kaizer', 'tartar', 'lumia menu', 'vortex menu', 'pulse menu', '2take1', 'cherax', 'yimmenu', 'kiddion', 'modest-menu', 'stand launchpad', 'mason-gta', 'mason cheat', 'nightfall', 'smg-gta', 'smg_cheat', 'smg majestic'],
      weak: () => ['nightfall', 'keyser', 'kaizer', 'tartar', 'phaze'],
      roots: () => [String.raw`($env:LOCALAPPDATA + '\FiveM')`, String.raw`($env:LOCALAPPDATA + '\GTA5RP')`, String.raw`($env:LOCALAPPDATA + '\Majestic')`, String.raw`($env:APPDATA + '\Majestic')`, String.raw`($env:SystemDrive + '\RAGEMP')`, String.raw`(Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\WOW6432Node\Rockstar Games\Grand Theft Auto V' -ErrorAction SilentlyContinue).InstallFolder`, String.raw`($env:ProgramFiles + '\Epic Games\GTAV')`, ...shared],
      // Folders that only a cheat makes: if one exists, it is a finding in itself, whatever is inside.
      cheatRoots: [String.raw`($env:APPDATA + '\Stand')`],
      steamGames: ['Grand Theft Auto V', 'Grand Theft Auto V Enhanced'],
      modules: ['GTA5', 'GTA5_Enhanced', 'FiveM*'],
      source: 'Меню для FiveM из списков античитов (Eulen, RedEngine, Susano, Skript.gg, HX, TZ Project и другие), меню для GTA Online и названия, под которыми продают читы для GTA5RP и Majestic.'
    },
    cs2: {
      label: 'Counter-Strike 2',
      tasks: ['all', 'processes', 'prefetch', 'registry', 'recycle', 'defender', 'autostart', 'services', 'hosts', 'folders', 'drives'],
      terms: () => ['neverlose', 'aimware', 'memesense', 'nixware', 'midnight.im', 'osiris', 'osiriscs2'],
      weak: () => ['osiris'],
      roots: () => [...shared],
      cheatRoots: [String.raw`($env:APPDATA + '\OsirisCS2')`, String.raw`($env:APPDATA + '\Neverlose')`],
      steamGames: ['Counter-Strike Global Offensive'],
      modules: ['cs2'],
      source: 'Платные и открытые читы, у которых есть версия для CS2. Переименованный файл или чит внутри другого процесса поиск по имени не найдёт; это не замена VAC.'
    }
  };

  /* ───── Blocks ───── */
  // Distinctive names are found inside longer names (NursultanClient.jar, EulenLoader.exe); common words and other
  // programs (game.weak) only as a separate word, so 'osiris' does not fire on every word that contains it. The
  // lookarounds are written without "!": cmd.exe with delayed expansion would eat the text between two of them.
  const matcher = game => {
    const weak = new Set(game.weak());
    const strong = game.terms().filter(term => !weak.has(term)).sort((a, b) => b.length - a.length);
    const escaped = name => `(($${name} | ForEach-Object { [regex]::Escape($_) }) -join '|')`;
    return [
      `$strong = @(${list(strong)})`,
      `$weak = @(${list([...weak])})`,
      `$rx = [regex]::new('(?<s>' + ${escaped('strong')} + ')|(?<=^|[^a-z0-9])(?<w>' + ${escaped('weak')} + ')(?=[^a-z0-9]|$)', 'IgnoreCase')`
    ];
  };

  const core = game => [
    `$ErrorActionPreference = 'SilentlyContinue'`,
    ...matcher(game),
    `$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)`,
    `$hits = New-Object System.Collections.ArrayList`,
    `$notes = New-Object System.Collections.ArrayList`,
    `$stat = @{ Files = 0; Jars = 0; Denied = 0 }`,
    `function Add-TraceHit([string]$source, [string]$object, [string]$detail, [bool]$weak = $false) {`,
    `  [void]$hits.Add([pscustomobject]@{ Source = $source; Object = $object; Detail = $detail; Weak = $weak })`,
    `}`,
    `function Add-TraceNote([string]$text) {`,
    `  if (-not $notes.Contains($text)) { [void]$notes.Add($text) }`,
    `}`,
    // The profile folder (C:\Users\<name>) is left out of the match: the Windows user name is not a finding.
    `function Find-TraceName([string]$source, [string]$text, [string]$object, [string]$detail) {`,
    `  $best = $null`,
    String.raw`  foreach ($m in $rx.Matches(($text -replace '(?i)[\\/]Users[\\/][^\\/]+', '\Users\~'))) { if ($m.Groups['s'].Success) { $best = $m; break }; if (-not $best) { $best = $m } }`,
    `  if (-not $best) { return }`,
    `  $isWeak = -not $best.Groups['s'].Success`,
    `  $info = 'название ' + $best.Value.ToLower()`,
    `  if ($isWeak) { $info += ', общее слово или обычная программа: возможно ложное совпадение' }`,
    `  if ($detail) { $info += '; ' + $detail }`,
    `  if (-not $object) { $object = $text }`,
    `  Add-TraceHit $source $object $info $isWeak`,
    `}`,
    `function Write-TraceStep([string]$text) {`,
    `  Write-Host ('  > ' + $text) -ForegroundColor DarkGray`,
    `}`,
    // Elevated with another account's password, the command reads that account's folders and history, not the player's.
    String.raw`$owner = Get-CimInstance Win32_Process -Filter 'Name = ''explorer.exe''' | Select-Object -First 1 | Invoke-CimMethod -MethodName GetOwner`,
    `if ($owner.User -and $owner.User -ne $env:USERNAME) { Write-Host ('Команда запущена от имени ' + $env:USERNAME + ', а в Windows работает ' + $owner.User + ': папки и история ' + $owner.User + ' не проверяются. Запустите терминал из учётной записи игрока.') -ForegroundColor Yellow }`
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
    `    foreach ($item in @(Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue -ErrorVariable denied)) {`,
    `      if ($item.PSIsContainer) { if (-not ($item.Attributes -band 1024)) { $stack.Push($item.FullName) } } else { $stat.Files++ }`,
    `      Find-TraceName 'Файл' $item.Name $item.FullName ('изменён ' + $item.LastWriteTime.ToString('dd.MM.yyyy HH:mm'))`,
    `    }`,
    `    if ($denied) { $stat.Denied++ }`,
    `  }`,
    `  Write-Progress -Activity 'TRACE' -Completed`,
    `}`
  ];

  // A package is a folder inside the archive (ru/nursultan/...), never a class name: Twilight Forest has a Raven class.
  const jarCheck = game => [
    `Add-Type -AssemblyName System.IO.Compression.FileSystem`,
    `$signatures = @(${list(game.jar())})`,
    String.raw`$sig = [regex]::new('(^|/)(' + (($signatures | ForEach-Object { [regex]::Escape($_) }) -join '|') + ')/', 'IgnoreCase')`,
    `function Find-TraceJar($file) {`,
    `  if ($file.Length -gt 268435456) { Add-TraceNote ('JAR больше 256 МБ пропущен: ' + $file.FullName); return }`,
    // A file kept only in OneDrive would be downloaded by opening it.
    `  if ($file.Attributes -band 0x441000) { Add-TraceNote ('JAR лежит только в облаке и не открывался: ' + $file.FullName); return }`,
    `  try { $zip = [IO.Compression.ZipFile]::OpenRead($file.FullName) } catch { Add-TraceNote ('JAR не прочитан: ' + $file.FullName); return }`,
    `  $stat.Jars++`,
    `  try {`,
    `    foreach ($entry in $zip.Entries) {`,
    `      $m = $sig.Match($entry.FullName)`,
    `      if ($m.Success -and $entry.FullName -like '*.class') { Add-TraceHit 'Пакет в JAR' $file.FullName ('пакет ' + $m.Groups[2].Value.ToLower() + ', запись ' + $entry.FullName + '; проверяются имена пакетов, а не поведение'); break }`,
    `    }`,
    `  } finally {`,
    `    $zip.Dispose()`,
    `  }`,
    `}`
  ];

  // Downloads and Desktop are taken where Windows keeps them (OneDrive, another disk); Steam games in every library.
  const roots = game => [
    String.raw`$downloads = $env:USERPROFILE + '\Downloads'`,
    `try { $shellDownloads = (New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path; if ($shellDownloads) { $downloads = $shellDownloads } } catch {}`,
    `$roots = @(${game.roots().join(', ')})`,
    ...(game.steamGames ? [
      String.raw`$steam = [string](Get-ItemProperty -LiteralPath 'HKCU:\Software\Valve\Steam').SteamPath`,
      `$libraries = @($steam)`,
      String.raw`$vdf = [string](Get-Content -LiteralPath ($steam + '\steamapps\libraryfolders.vdf') -Raw)`,
      String.raw`foreach ($m in [regex]::Matches($vdf, '\x22path\x22\s+\x22([^\x22]+)\x22')) { $libraries += $m.Groups[1].Value -replace '\\\\', '\' }`,
      String.raw`foreach ($lib in @($libraries | Where-Object { $_ } | Select-Object -Unique)) { foreach ($name in @(${list(game.steamGames)})) { $roots += $lib + '\steamapps\common\' + $name } }`
    ] : []),
    ...(game.cheatRoots ? [`$cheatRoots = @(${game.cheatRoots.join(', ')})`, `$roots += $cheatRoots`] : [])
  ];

  const steps = {
    processes: game => [
      `Write-TraceStep 'Процессы'`,
      `try { $procs = @(Get-CimInstance Win32_Process -ErrorAction Stop) } catch { $procs = @(Get-Process | ForEach-Object { [pscustomobject]@{ Name = $_.ProcessName + '.exe'; ExecutablePath = $_.Path; ProcessId = $_.Id; CommandLine = '' } }); Add-TraceNote 'WMI не ответил: процессы взяты из Get-Process, без строк запуска.' }`,
      `foreach ($p in $procs) {`,
      `  $object = [string]$p.ExecutablePath`,
      `  if (-not $object) { $object = [string]$p.Name }`,
      `  Find-TraceName 'Процесс' ([string]$p.Name + ' ' + $object) $object ('PID ' + $p.ProcessId)`,
      ...(game === games.minecraft ? [
        // The launch line holds the session token and the player's name; only the agent path, the two options and a
        // matched name are shown, never the line.
        `  if ($p.Name -like 'java*') {`,
        `    $line = [string]$p.CommandLine`,
        String.raw`    foreach ($agent in [regex]::Matches($line, '-javaagent:(.+?\.jar)(?=[\s\x22=]|$)')) { Add-TraceHit 'Java: -javaagent' $agent.Groups[1].Value ('PID ' + $p.ProcessId + '; агент встраивается в игру, проверьте этот файл') }`,
        String.raw`    foreach ($flag in [regex]::Matches($line, '(?:^|[\s\x22])(-noverify|-Xbootclasspath[^\s\x22]*)')) { Add-TraceHit 'Java: аргумент' $flag.Groups[1].Value ('PID ' + $p.ProcessId + '; отключает проверку классов или подменяет их') }`,
        String.raw`    Find-TraceName 'Java: строка запуска' ($line -replace '(?i)--(username|uuid|xuid|accessToken|clientId)\s+\S+', '') ('java, PID ' + $p.ProcessId) 'сама строка не выводится'`,
        `  }`
      ] : []),
      `}`,
      `foreach ($g in @(Get-Process -Name ${list(game.modules)} -ErrorAction SilentlyContinue)) {`,
      // The method, not the property: PowerShell turns an exception inside a property into an empty value.
      `  try { $mods = @($g.get_Modules()) } catch { Add-TraceNote ('DLL процесса ' + $g.Name + ' не прочитаны: процесс закрыт античитом или нужны права администратора.'); continue }`,
      `  foreach ($mod in $mods) {`,
      `    Find-TraceName ('DLL в ' + $g.Name) $mod.FileName $mod.FileName ('PID ' + $g.Id)`,
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
      `  if (-not (Test-Path -LiteralPath $base)) { continue }`,
      `  try { $users = @(Get-ChildItem -LiteralPath $base -ErrorAction Stop) } catch { Add-TraceNote 'BAM не прочитан: нужны права администратора.'; continue }`,
      `  foreach ($key in $users) {`,
      // BAM keeps every account of the PC; the account is named so a sibling's history is not taken for the player's.
      `    $account = $key.PSChildName`,
      `    try { $account = (New-Object Security.Principal.SecurityIdentifier($key.PSChildName)).Translate([Security.Principal.NTAccount]).Value } catch {}`,
      `    foreach ($name in $key.GetValueNames()) {`,
      `      $value = $key.GetValue($name)`,
      `      $when = 'учётная запись ' + $account`,
      `      if ($value -is [byte[]] -and $value.Length -ge 8) { $when += ', запуск ' + [DateTime]::FromFileTime([BitConverter]::ToInt64($value, 0)).ToString('dd.MM.yyyy HH:mm') }`,
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
      String.raw`  foreach ($item in @($bin.Items())) { Find-TraceName 'Корзина' $item.Name ($bin.GetDetailsOf($item, 1) + '\' + $item.Name) ('удалён ' + ($bin.GetDetailsOf($item, 2) -replace '[\u200e\u200f]', '')) }`,
      `} catch {`,
      `  Add-TraceNote 'Корзина не прочитана.'`,
      `}`
    ],
    defender: () => [
      `Write-TraceStep 'Defender'`,
      `try {`,
      `  $mp = Get-MpPreference -ErrorAction Stop`,
      // Without administrator rights Defender returns an "N/A ..." line instead of the list; it is not an exclusion.
      `  if ($admin) {`,
      `    foreach ($path in @($mp.ExclusionPath) + @($mp.ExclusionProcess) + @($mp.ExclusionExtension)) { if ($path -and $path -notlike 'N/A*') { Add-TraceHit 'Defender: исключение' $path 'это антивирус не проверяет; выясните, кто и зачем это добавил' } }`,
      `  } else {`,
      `    Add-TraceNote 'Исключения Defender видны только администратору.'`,
      `  }`,
      `  $status = Get-MpComputerStatus -ErrorAction SilentlyContinue`,
      `  if ($status.AMRunningMode -and $status.AMRunningMode -ne 'Normal') { Add-TraceNote ('Defender в режиме ' + $status.AMRunningMode + ': компьютер защищает другой антивирус.') } elseif ($status -and -not $status.RealTimeProtectionEnabled) { Add-TraceHit 'Defender' 'Защита в реальном времени выключена' 'выясните, кто и когда её выключил' }`,
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
    folders: game => [
      `Write-TraceStep 'Папки игры'`,
      ...(game.cheatRoots ? [`foreach ($dir in $cheatRoots) { if (Test-Path -LiteralPath $dir) { Add-TraceHit 'Папка' $dir 'папка программы из списка; посмотрите, что в ней' } }`] : []),
      `Find-TraceFiles $roots`
    ],
    jar: () => [
      `Write-TraceStep 'Пакеты в JAR'`,
      `foreach ($root in $roots) {`,
      `  if ($root -and (Test-Path -LiteralPath $root -PathType Container)) { foreach ($file in @(Get-ChildItem -LiteralPath $root -Filter *.jar -File -Recurse -Force -ErrorAction SilentlyContinue)) { Find-TraceJar $file } }`,
      `}`
    ],
    drives: () => [
      `Write-TraceStep 'Все диски и флешки. Это долго; остановить можно Ctrl+C'`,
      `Find-TraceFiles @([IO.DriveInfo]::GetDrives() | Where-Object { $_.IsReady -and ($_.DriveType -eq 'Fixed' -or $_.DriveType -eq 'Removable') } | ForEach-Object { $_.RootDirectory.FullName })`
    ]
  };

  // Runs in finally: Ctrl+C during a long walk still prints what was found. Clear names first, weak words last.
  const report = [
    `Write-Progress -Activity 'TRACE' -Completed`,
    `Write-Host ''`,
    `$found = @($hits | Sort-Object Source, Object, Detail -Unique | Sort-Object Weak, Source, Object)`,
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
    `if ($stat.Denied) { Add-TraceNote ('папок, которые не открылись: ' + $stat.Denied + '; их содержимое не проверено.') }`,
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
      'try {',
      ...parts.flatMap(key => steps[key](game)),
      '} finally {',
      ...report,
      '}'
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
  // The pieces (each source line with the glue after it) let the page show the one line broken where it was written.
  function oneLinePieces(lines) {
    const clean = lines.map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    return clean.map((line, i) => {
      const next = clean[i + 1];
      if (next === undefined) return line;
      return line + (/[{(,|]$/.test(line) || /^([})]|(else|elseif|catch|finally)\b)/.test(next) ? ' ' : '; ');
    });
  }
  const oneLine = lines => oneLinePieces(lines).join('');

  // The page shows TRACE-PRO indented inside its wrapper and without comment lines; the downloadable file keeps them.
  function minecraftAll(withIntro) {
    const block = pro()[withIntro ? 'full' : 'compact'].split(/\r?\n/).filter(line => !/^\s*#/.test(line)).map(line => line ? `  ${line}` : line);
    return ['& {', `  $SkipIntro = $${withIntro ? 'false' : 'true'}`, '  $AnimationOnly = $false', `  $Preset = 'minecraft'`, ...block, '}'];
  }
  // A multi-line command as its lines, each but the last ending in CRLF.
  const asLines = lines => lines.map((line, i) => i < lines.length - 1 ? `${line}\r\n` : line);
  // A one-line cmd.exe command as its pieces: the wrapper is glued to the first and the last piece.
  const asOneLine = (head, pieces) => pieces.map((piece, i) => (i ? '' : head) + piece + (i === pieces.length - 1 ? '"' : ''));

  /* The command as pieces whose concatenation is exactly what is copied. The page draws each piece on its own line
     (a one-line CMD command is drawn broken where its source lines were) and sets the TRACE art tighter. */
  function commandPieces(gameKey, method, taskKey, withIntro = true) {
    if (!Object.hasOwn(games, gameKey) || !Object.hasOwn(tasks, taskKey) || !games[gameKey].tasks.includes(taskKey)) throw new Error(`Unknown command ${gameKey}/${taskKey}`);
    // TRACE-PRO is the whole check for Minecraft in PowerShell; it is too long for one cmd.exe line (8191 characters).
    if (gameKey === 'minecraft' && taskKey === 'all' && method === 'powershell') return asLines(minecraftAll(withIntro));
    if (method === 'cmd' && taskKey === 'all') return cmdFile(gameKey, withIntro);
    const lines = taskLines(gameKey, taskKey, withIntro);
    if (method === 'cmd') return asOneLine('powershell -NoProfile -Command "', oneLinePieces(lines));
    return asLines(['& {', ...indent(lines, '  '), '}']);
  }
  const command = (...args) => commandPieces(...args).join('');

  // The whole check does not fit into one cmd.exe line, so in CMD it runs the downloaded file of the same check: the
  // newest trace-….ps1 in the Downloads folder, wherever Windows keeps it, so a second download saved as
  // "trace-gta (1).ps1" is the one that runs. -ExecutionPolicy Bypass applies to this one run only.
  const fileFor = gameKey => gameKey === 'minecraft' ? 'trace-pro-minecraft.ps1' : `trace-${gameKey}.ps1`;
  function cmdFile(gameKey, withIntro) {
    const name = fileFor(gameKey), stem = name.replace(/\.ps1$/, '');
    const extra = (gameKey === 'minecraft' ? ' -Preset minecraft' : '') + (withIntro ? '' : ' -SkipIntro');
    const lines = [
      `$file = Get-ChildItem -LiteralPath (New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path -Filter '${stem}*.ps1' | Sort-Object LastWriteTime -Descending | Select-Object -First 1`,
      `if ($file) { & $file.FullName${extra} } else { Write-Host 'В папке «Загрузки» нет файла ${name}: скачайте его кнопкой на странице проверки.' -ForegroundColor Yellow }`
    ];
    return asOneLine('powershell -NoProfile -ExecutionPolicy Bypass -Command "', oneLinePieces(lines));
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

  // coreLines is for scripts/verify-commands.mjs: it runs the matching rules on test names.
  root.TraceCommands = {games, tasks, about, asciiTrace, command, commandPieces, oneLine, scriptFile, fileFor, coreLines: gameKey => core(games[gameKey])};
})();
