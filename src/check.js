'use strict';

const methods = {
  powershell: {
    title:'PowerShell', kicker:'Полная проверка', terminal:'Windows PowerShell', prompt:'PS >',
    description:'Ищет названия известных читов в процессах, папках и Prefetch. После запуска откроется меню: быстрый поиск, папки игры, все локальные диски или выбранная папка.',
    download:'scripts/trace-check.ps1', downloadLabel:'Скачать общий отчёт .ps1 ↓',
    guide:'<ol><li>Запускайте только на своём устройстве или с явного согласия владельца. Для официальной удалённой проверки соблюдайте правила сервера.</li><li>Откройте Windows PowerShell. С правами администратора доступно больше системных источников; без них команда тоже работает, но часть проверки пропустит.</li><li>Выберите игру, прочитайте команду, скопируйте, вставьте в PowerShell и нажмите Enter. После заставки TRACE появится меню.</li><li>Режим 1 — быстрый поиск по процессам и Prefetch. Режим 2 добавляет папки игры, «Загрузки» и временную папку. Режим 3 обходит все локальные диски и может работать долго; остановить его можно Ctrl+C. В режиме 4 вы указываете папку сборки или лаунчера.</li><li>Совпадение имени — повод разобраться, а не доказательство того, что чит запускали на сервере. Пустой результат не доказывает, что ПК чист.</li></ol>'
  },
  // TRACE-PRO for Minecraft has its own menu and runs at once when a depth is chosen on the page.
  powershellMinecraft: {
    guide:'<ol><li>Запускайте только на своём устройстве или с явного согласия владельца. Для официальной удалённой проверки соблюдайте правила сервера.</li><li>Откройте Windows PowerShell. С правами администратора сценарий читает больше системных источников (журналы событий, журнал USN); без них он тоже работает и в конце пишет, что пропустил.</li><li>Выберите глубину, прочитайте команду, скопируйте её, вставьте в PowerShell и нажмите Enter.</li><li>Если выбрана глубина, проверка этой глубины начнётся сразу после заставки. Если выбрано «Меню в терминале», TRACE-PRO спросит режим: 1 — экспресс-аудит системы (службы, журналы, реестр, Defender, планировщик, корзина, hosts, процессы Java), 2 — то же плюс папки Minecraft и лаунчеров с содержимым JAR, 3 — то же на всех локальных дисках, 4 — только одна папка, которую вы укажете.</li><li>После проверки меню остаётся открытым: пункт 5 сохраняет отчёт в JSON и CSV, 0 закрывает сценарий.</li><li>Совпадение имени — повод разобраться, а не доказательство того, что чит запускали на сервере. Пустой результат не доказывает, что ПК чист.</li></ol>'
  },
  cmd: {
    title:'CMD', kicker:'Быстрая проверка', terminal:'Командная строка Windows', prompt:'C:\\>',
    description:'Ищет названия известных читов среди запущенных процессов и файлов в основных папках выбранной игры.',
    download:'scripts/trace-check.cmd', downloadLabel:'Скачать общий отчёт .cmd ↓',
    guide:'<ol><li>Получите согласие владельца компьютера. В удалённой проверке сначала откройте правила своего сервера.</li><li>Откройте CMD от имени администратора, чтобы был доступ к большему числу папок.</li><li>Выберите игру, прочитайте команду, скопируйте и вставьте её в CMD.</li><li>Результат появится в окне. Пустой результат не значит, что запрещённых модификаций нет.</li></ol><p>Скачиваемый .cmd просит подтверждение и сохраняет список процессов в CSV в папку TEMP. Ничего не удаляет.</p>'
  },
  manual: {
    title:'Вручную', kicker:'Без команд',
    description:'Посмотрите запущенные процессы и папку игры сами, без команд. Отмечайте только то, что действительно сделали.'
  }
};

const games = {
  minecraft: {
    label:'MINECRAFT', note:'FunTime · SpookyTime · ReallyWorld · HolyWorld',
    psDescription:'TRACE-PRO смотрит глубже простого поиска по именам: Java-процессы, системные следы Windows, папки игры и названия классов внутри JAR. Ничего не уходит с вашего ПК.',
    manual:'Откройте Диспетчер задач (Ctrl+Shift+Esc), затем папку той сборки Minecraft, которая сейчас запущена. Посмотрите mods и versions и сравните моды с правилами сервера. У FunTime и остальных серверов правила разные.',
    context:'У Nursultan, Delta и Rockstar есть действующие страницы проекта; AlekDLC встречается как название предложения. «Alek Solution» добавлен как вариант написания для поиска: отдельного продукта с таким названием Trace не подтвердил. Совпадение по этим именам не доказывает, что чит использовали на FunTime или другом сервере.',
    names:[['Nursultan Client','проект'],['AlekDLC / Alek Solution','варианты имени'],['Delta Client','проект'],['Rockstar Client','проект']],
    links:[['Nursultan / канал','https://t.me/s/nursultan_mc'],['Delta / канал','https://t.me/s/dlcformine'],['Rockstar / автор','https://rockstar.pub/'],['FunTime / модификации','https://forum.funtime.su/modifications']],
    indicators:['nursultan','alekdlc','alekclient','alek solution','alek-','alek_','alek.jar','delta client','deltadlc','rockstar client','rockstar.jar','.minecraft\\Rockstar\\'],
    cmdIndicators:['nursultan','alekdlc','alekclient','alek solution','alek-','alek_','alek.jar','delta client','deltadlc','rockstar client','rockstar.jar','\\.minecraft\\Rockstar\\'],
    psRoots:[String.raw`"$env:APPDATA\.minecraft"`,String.raw`"$env:APPDATA\.tlauncher"`,String.raw`"$env:USERPROFILE\Downloads"`,String.raw`"$env:LOCALAPPDATA\Temp"`],
    cmdRoots:[String.raw`"%APPDATA%\.minecraft"`,String.raw`"%APPDATA%\.tlauncher"`,String.raw`"%USERPROFILE%\Downloads"`,String.raw`"%LOCALAPPDATA%\Temp"`],
    result:'В системных режимах TRACE-PRO читает процессы Java с аргументами запуска, Prefetch и BAM/UserAssist/RunMRU; режим папки смотрит только файлы и JAR. Часть источников открыта только администратору, а полный обход дисков может идти долго. Отчёт сохраняется, только если вы выберете пункт 5. В нём могут быть имя пользователя, личные пути и аргументы процессов. Проверьте его, прежде чем кому-то отправлять.'
  },
  gta: {
    label:'GTA V RP', note:'GTA5RP · Majestic',
    manual:'Откройте папку лаунчера GTA5RP или Majestic и папку игры. Сравните название подозрительного файла с запущенными процессами и временем запуска. Правила сервера в приоритете.',
    context:'Продавцы выдают MASON, NIGHTFALL и SMG за читы для GTA V RP или Majestic. Это их слова, а не подтверждение, что чит работает на конкретном сервере. У Majestic собственный лаунчер; старая папка RAGE:MP сама по себе не признак Majestic.',
    names:[['MASON','GTA V RP'],['NIGHTFALL','Majestic'],['SMG','Majestic']],
    links:[['MASON / продукт','https://hackexe.com/ru/game/gta-5-rp/product/mason-cheat-gta-5-rp'],['NIGHTFALL / продукт','https://cheatside.ru/product/majestic-rp/nightfall'],['SMG / продукт','https://procheat.pro/en/gta-5-cheats/gta-5-rp-majestic-ragemp-smg-cheat'],['Majestic / установка','https://wiki.majestic-rp.ru/ru/posts/ustanovka-igry']],
    indicators:['mason-gta','mason cheat','nightfall','smg-gta','smg_cheat','smg majestic'],
    cmdIndicators:['mason-gta','mason cheat','nightfall','smg-gta','smg_cheat','smg majestic'],
    psRoots:[String.raw`"$env:LOCALAPPDATA\GTA5RP"`,String.raw`"$env:LOCALAPPDATA\Majestic"`,String.raw`"$env:APPDATA\Majestic"`,String.raw`"$env:USERPROFILE\Downloads"`,String.raw`"$env:LOCALAPPDATA\Temp"`],
    cmdRoots:[String.raw`"%LOCALAPPDATA%\GTA5RP"`,String.raw`"%LOCALAPPDATA%\Majestic"`,String.raw`"%APPDATA%\Majestic"`,String.raw`"%USERPROFILE%\Downloads"`,String.raw`"%LOCALAPPDATA%\Temp"`],
    result:'Ищет названия, которые продавцы относят к GTA V RP и Majestic. Слова вроде «Mason» и «SMG» сами по себе дают много ложных совпадений, поэтому фильтр ищет более характерные сочетания.'
  },
  cs2: {
    label:'COUNTER-STRIKE 2', note:'Steam · Counter-Strike 2',
    manual:'В Steam откройте свойства CS2 → Установленные файлы → Проверить целостность. Потом посмотрите процессы и папку %APPDATA%\\OsirisCS2\\configs. Проверка в Steam память игры не анализирует.',
    context:'У Neverlose и AIMWARE есть разделы об обновлениях для CS2. У Osiris есть репозиторий автора. Имена исполняемых файлов у разных вариантов не подтверждены, а поиск по названию память не анализирует и может ничего не найти.',
    names:[['Neverlose','CS2'],['AIMWARE','CS2'],['Osiris','открытый код'],['OsirisCS2','конфигурация']],
    links:[['Neverlose / обновление','https://forum.neverlose.cc/t/major-cs2-product-update-double-precision-15-09-26/592958'],['AIMWARE / обновления','https://aimware.net/forum/board/47'],['Osiris / автор','https://github.com/danielkrupinski/Osiris']],
    indicators:['neverlose','aimware','osiris','osiriscs2'],
    cmdIndicators:['neverlose','aimware','osiris','osiriscs2'],
    psRoots:[String.raw`"$env:APPDATA\OsirisCS2"`,String.raw`"$env:APPDATA\Neverlose"`,String.raw`"$env:USERPROFILE\Downloads"`,String.raw`"$env:LOCALAPPDATA\Temp"`],
    cmdRoots:[String.raw`"%APPDATA%\OsirisCS2"`,String.raw`"%APPDATA%\Neverlose"`,String.raw`"%USERPROFILE%\Downloads"`,String.raw`"%LOCALAPPDATA%\Temp"`],
    result:'Сравнивает имена процессов и файлов, папку OsirisCS2 и Prefetch. Переименованный файл или чит внутри другого процесса поиск по имени пропустит. Это не замена VAC и не разбор матча.'
  }
};

const asciiTrace = [
  '████████╗██████╗  █████╗  ██████╗███████╗',
  '╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██╔════╝',
  '   ██║   ██████╔╝███████║██║     █████╗  ',
  '   ██║   ██╔══██╗██╔══██║██║     ██╔══╝  ',
  '   ██║   ██║  ██║██║  ██║╚██████╗███████╗',
  '   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝'
];
const shownWithoutIntro = new Set();
const selectionKey = (method,game) => `${method}:${game}`;

function powerShellCommand(game,withIntro) {
  const terms=game.indicators.map(term=>`'${term.replaceAll("'","''")}'`).join(', ');
  const art=withIntro?`
  $traceArt = @(${asciiTrace.map(line=>`'${line}'`).join(', ')})
  $traceColours = @('DarkYellow','DarkYellow','Yellow','Yellow','White','DarkYellow')
  for ($i=0; $i -lt $traceArt.Count; $i++) { Write-Host $traceArt[$i] -ForegroundColor $traceColours[$i] }
  Write-Host '                         Локальная проверка: ваш компьютер' -ForegroundColor DarkGray
  Write-Host ''`:'';
  return String.raw`& {
  # TRACE: локальный поиск по названиям, только чтение. Ничего не отправляется и не удаляется.
  $ErrorActionPreference = 'SilentlyContinue'
  $terms = @(${terms})
  $gameRoots = @(${game.psRoots.join(', ')})
  $hits = New-Object 'System.Collections.Generic.List[object]'
  $stats = @{ Seen = 0 }
  function Test-TraceName([string]$text) {
    if ([string]::IsNullOrWhiteSpace($text)) { return $false }
    foreach ($term in $terms) {
      if ($text.IndexOf($term,[StringComparison]::OrdinalIgnoreCase) -ge 0) { return $true }
    }
    return $false
  }
  function Add-TraceHit([string]$source,[string]$name,[string]$path,[string]$detail) {
    if ($hits.Count -lt 300) {
      $hits.Add([pscustomobject]@{Source=$source;Name=$name;Path=$path;Detail=$detail})
    }
  }
  function Find-TraceProcesses {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object {
      if ((Test-TraceName $_.Name) -or (Test-TraceName $_.ExecutablePath)) {
        Add-TraceHit 'PROCESS' $_.Name $_.ExecutablePath ('PID ' + $_.ProcessId)
      }
    }
  }
  function Find-TracePrefetch {
    $folder = Join-Path $env:WINDIR 'Prefetch'
    if (Test-Path -LiteralPath $folder -PathType Container) {
      Get-ChildItem -LiteralPath $folder -File -ErrorAction SilentlyContinue | ForEach-Object {
        if (Test-TraceName $_.Name) {
          Add-TraceHit 'PREFETCH' $_.Name $_.FullName $_.LastWriteTime.ToString('s')
        }
      }
    }
  }
  function Find-TraceFiles([string[]]$folders) {
    $valid = @($folders | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Container) } | Select-Object -Unique)
    foreach ($folder in $valid) {
      Write-Host ('  проверяю ' + $folder) -ForegroundColor DarkGray
      Get-ChildItem -LiteralPath $folder -File -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
        $stats.Seen++
        if ((Test-TraceName $_.Name) -or (Test-TraceName $_.FullName)) {
          Add-TraceHit 'FILE' $_.Name $_.FullName $_.LastWriteTime.ToString('s')
        }
      }
    }
    return $valid.Count
  }
  function Show-TraceResult([string]$scope,[int]$folderCount) {
    Write-Host ''
    Write-Host ('TRACE / ' + $scope) -ForegroundColor Cyan
    if ($hits.Count) { $hits | Sort-Object Source,Path -Unique | Format-List Source,Name,Path,Detail }
    else { Write-Host 'Совпадений по названиям не найдено.' -ForegroundColor Yellow }
    Write-Host ('Папок: ' + $folderCount + ', файлов: ' + $stats.Seen + ', совпадений: ' + $hits.Count + '.') -ForegroundColor DarkGray
    if ($hits.Count -ge 300) { Write-Host 'Показаны первые 300 совпадений. Чтобы увидеть остальные, выберите режим или папку поуже.' -ForegroundColor Yellow }
    Write-Host 'Совпадение названия — повод разобраться, а не доказательство. Пустой результат не доказывает, что ПК чист.' -ForegroundColor DarkYellow
  }${art}
  while ($true) {
    Write-Host '╭──────────────── TRACE / РЕЖИМ ────────────────╮' -ForegroundColor DarkCyan
    Write-Host '│  1  Быстрый поиск   Процессы + Prefetch       │' -ForegroundColor Gray
    Write-Host '│  2  По игре         Папки игры + загрузки     │' -ForegroundColor Gray
    Write-Host '│  3  Весь ПК         Все локальные диски       │' -ForegroundColor Gray
    Write-Host '│  4  Своя папка      Сборка или лаунчер        │' -ForegroundColor Gray
    Write-Host '│  0  Выход                                    │' -ForegroundColor Gray
    Write-Host '╰───────────────────────────────────────────────╯' -ForegroundColor DarkCyan
    $choice = (Read-Host 'TRACE / выбор').Trim()
    if ($choice -eq '0') { break }
    if ($choice -notin @('1','2','3','4')) { Write-Host 'Выберите 0–4.' -ForegroundColor Yellow; continue }
    $hits.Clear(); $stats.Seen = 0
    Find-TraceProcesses
    Find-TracePrefetch
    $folderCount = 0
    if ($choice -eq '2') { $folderCount = Find-TraceFiles $gameRoots }
    if ($choice -eq '3') {
      Write-Host 'Полный обход дисков может занять много времени. Ctrl+C прерывает его.' -ForegroundColor Yellow
      $fixed = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction SilentlyContinue | ForEach-Object { $_.DeviceID + '\' })
      $folderCount = Find-TraceFiles $fixed
    }
    if ($choice -eq '4') {
      $custom = (Read-Host 'Путь к папке').Trim().Trim('"')
      if (-not (Test-Path -LiteralPath $custom -PathType Container)) { Write-Host 'Папка не найдена.' -ForegroundColor Yellow; continue }
      $folderCount = Find-TraceFiles @($custom)
    }
    $scopeNames = @{'1'='БЫСТРЫЙ ПОИСК';'2'='ПО ИГРЕ';'3'='ВЕСЬ ПК';'4'='СВОЯ ПАПКА'}
    Show-TraceResult $scopeNames[$choice] $folderCount
    Write-Host ''
  }
}`;
}

function cmdCommand(game) {
  const filters=game.cmdIndicators.map(name=>`/c:"${name}"`).join(' ');
  return [
    'echo [TRACE] Локальный поиск по названиям',
    'echo [TRACE] Запущенные процессы:',
    `tasklist /fo csv /nh | findstr /l /i ${filters}`,
    'echo [TRACE] Папки игры, «Загрузки» и временная папка:',
    `for %R in (${game.cmdRoots.join(' ')}) do @if exist "%~R" (dir /s /b "%~R" 2>nul | findstr /l /i ${filters})`,
    'echo [TRACE] Prefetch:',
    `if exist "%WINDIR%\\Prefetch" (dir /b "%WINDIR%\\Prefetch" 2>nul | findstr /l /i ${filters})`,
    'echo [TRACE] Совпадение названия — повод разобраться, а не доказательство. Пустой результат не доказывает, что ПК чист.'
  ].join('\r\n');
}

// Minecraft TRACE-PRO depths. Each level adds sources on top of the previous one;
// `menu` keeps the interactive choice inside the terminal.
const depthSources = [
  ['java','Процессы Java','аргументы JVM и загруженные DLL'],
  ['prefetch','Prefetch','следы запуска EXE'],
  ['services','Службы и журналы','PcaSvc, SysMain, очистка EventLog'],
  ['registry','Реестр','BAM, UserAssist, RunMRU'],
  ['defender','Defender','исключения антивируса'],
  ['tasks','Планировщик','автозадачи'],
  ['recycle','Корзина','имена удалённых файлов'],
  ['hosts','hosts','перенаправленные домены'],
  ['launchers','Папки лаунчеров','.minecraft, TLauncher, Lunar, Prism…'],
  ['jar','Классы в JAR','имена пакетов внутри модов'],
  ['drives','Все локальные диски','полный обход файлов']
];
const depthLevels = [
  {key:'quick',title:'Быстрый',time:'секунды',sources:['java','prefetch'],summary:'Только то, что запущено сейчас, и свежие следы запуска. Реестр, журналы и файлы не читаются.'},
  {key:'system',title:'Системный',time:'обычно до минуты',sources:['java','prefetch','services','registry','defender','tasks','recycle','hosts'],summary:'Системные следы Windows: история запусков, исключения антивируса, автозадачи и признаки очистки журналов.'},
  {key:'minecraft',title:'Minecraft',time:'несколько минут',sources:['java','prefetch','services','registry','defender','tasks','recycle','hosts','launchers','jar'],summary:'Системный уровень плюс папки лаунчеров, загрузки и имена классов внутри каждого JAR. Рекомендуемая глубина.'},
  {key:'full',title:'Полный',time:'долго: зависит от числа файлов на дисках',sources:depthSources.map(([key])=>key),summary:'Всё перечисленное плюс обход всех локальных дисков с разбором JAR. Долго; остановить можно Ctrl+C.'}
];
const depthMenu = {key:'menu',title:'Меню в терминале',time:'выбор при запуске',sources:[],summary:'Команда откроет меню TRACE-PRO: режим, папку и сохранение отчёта вы выбираете прямо в PowerShell.'};

function minecraftCommand(withIntro,depth='menu') {
  const block=window.TraceMinecraftCommands[withIntro?'full':'compact'];
  return `& {\r\n  $SkipIntro = $${withIntro?'false':'true'}\r\n  $AnimationOnly = $false\r\n  $Preset = '${depth}'\r\n${block}\r\n}`;
}

function commandFor(gameKey,method,withIntro=true,depth='menu') {
  const game=games[gameKey];
  if(method==='powershell'&&gameKey==='minecraft')return minecraftCommand(withIntro,depth);
  if (method==='powershell') return powerShellCommand(game,withIntro);
  const core=cmdCommand(game);
  if (!withIntro) return core;
  const art=asciiTrace.map(line=>`echo ${line}`).join('\r\n');
  return `${art}\n${core}`;
}

const el = id => document.getElementById(id);
const {Spring, Motion, Lens, Morph, animate, materialize, morphHeight, reduced, clamp, mix, smooth} = window.TraceMotion;
const tabs = [...document.querySelectorAll('.tool-tab')];
let activeMethod = 'powershell';
let activeGame = null;

// Short labels swap like a split-flap: the old line leaves, the new one lands.
function swapText(frame, span, text, direction = 1) {
  if (span.textContent === text) return;
  if (reduced()) { span.textContent = text; return; }
  const ghost = span.cloneNode(true);
  ghost.removeAttribute('id'); ghost.setAttribute('aria-hidden', 'true');
  ghost.style.cssText = 'position:absolute;left:0;top:0;right:0;pointer-events:none';
  frame.append(ghost);
  span.textContent = text;
  animate(ghost, [{transform: 'none', opacity: 1, filter: 'blur(0)'}, {transform: `translateY(${-75 * direction}%)`, opacity: 0, filter: 'blur(3px)'}], {duration: 300, easing: TraceMotion.curves.inout}).then(() => ghost.remove());
  animate(span, [{transform: `translateY(${75 * direction}%)`, opacity: 0, filter: 'blur(3px)'}, {transform: 'none', opacity: 1, filter: 'blur(0)'}], {spring: 'snappy', fill: 'none'});
}

function renderSignals(game) {
  el('signal-game').textContent=game.label;
  el('signal-context').textContent=game.context;
  const names=el('signal-names'); names.replaceChildren();
  for(const [name,kind] of game.names){
    const badge=document.createElement('button'); badge.type='button'; badge.className='signal-name';
    // The name comes from what the button shows (WCAG 2.5.3) plus a hidden note on what a press does.
    const title=document.createElement('strong'); title.textContent=name;
    const type=document.createElement('small'); type.textContent=` ${kind}`;
    const action=document.createElement('span'); action.className='visually-hidden'; action.textContent=`, скопировать ${name.split(' / ')[0]}`;
    badge.append(title,type,action); names.append(badge);
    // One name at a time is what Everything and System Informer search for.
    badge.addEventListener('click',async()=>{
      const query=name.split(' / ')[0];
      try{
        await navigator.clipboard.writeText(query);
        badge.classList.remove('is-copied');void badge.offsetWidth;badge.classList.add('is-copied');
        setTimeout(()=>badge.classList.remove('is-copied'),1400);
        TraceUI.notify({title:`«${query}» скопировано`,detail:'Вставьте в поиск Everything или System Informer'});
      }catch{TraceUI.notify({title:'Не удалось скопировать',detail:'Выделите имя вручную'});}
    });
  }
  const links=el('signal-links'); links.replaceChildren();
  for(const [label,url] of game.links){
    const a=document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener noreferrer';
    a.append(label,' ');
    const icon=document.createElement('span'); icon.className='arrow'; icon.setAttribute('aria-hidden','true');
    icon.innerHTML='<svg class="glyph glyph-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11 11 5"/><path d="M6.2 5H11v4.8"/></svg>';
    a.append(icon); links.append(a);
  }
}

const terminalBody = document.querySelector('.terminal-body');
const syncTerminalEdge = () => terminalBody.classList.toggle('is-clipped', terminalBody.scrollHeight - terminalBody.scrollTop - terminalBody.clientHeight > 4);
terminalBody.addEventListener('scroll', syncTerminalEdge, {passive: true});

/* ───── Minecraft depth: a draggable dial that rewrites the command live ───── */
let depthIndex=2,depthMenuOn=false;
const currentDepth=()=>depthMenuOn?'menu':depthLevels[depthIndex].key;
const currentDepthInfo=()=>depthMenuOn?depthMenu:depthLevels[depthIndex];
const isMinecraftScript=()=>activeMethod==='powershell'&&el('game').value==='minecraft';
const currentCommand=(intro)=>{
  const gameKey=el('game').value;
  return commandFor(gameKey,activeMethod,intro??!shownWithoutIntro.has(selectionKey(activeMethod,gameKey)),currentDepth());
};

// The preset line is lifted out of the wall of script so the change is visible.
// What the terminal shows is exactly what the copy button copies.
let shownCommand='';
function showCommand({flash=false}={}){
  const text=currentCommand(),code=el('command'),marker="$Preset = '",at=text.indexOf(marker);
  shownCommand=text;
  if(at<0){code.textContent=text;return;}
  const end=text.indexOf('\r\n',at);
  const mark=document.createElement('mark');mark.className='cmd-flag';mark.textContent=text.slice(at,end);
  code.replaceChildren(text.slice(0,at),mark,text.slice(end));
  if(flash){
    terminalBody.scrollTo({top:0,behavior:reduced()?'auto':'smooth'});
    // The flash is a glow layer (::after in trace.css) that fades and settles; only opacity and transform move.
    if(!reduced())mark.animate([{opacity:1,transform:'scale(1.08)'},{opacity:0,transform:'none'}],{pseudoElement:'::after',duration:1100,easing:TraceMotion.curves.out,fill:'none'});
  }
}

function renderSelection({animated = true} = {}) {
  const method=methods[activeMethod];
  const gameKey=el('game').value;
  const game=games[gameKey];
  const gameChanged=activeGame!==gameKey;
  activeGame=gameKey;
  const panel=el('tool-panel');
  const minecraftScript=isMinecraftScript();
  const apply=()=>{
    document.body.dataset.game=gameKey;
    if(!animated){el('tool-title').textContent=method.title;el('tool-kicker').textContent=`Шаг 3 · ${method.kicker}`;}
    el('tool-description').textContent=activeMethod==='powershell'&&game.psDescription?game.psDescription:method.description;
    el('game-note').textContent=game.note;
    el('manual-guide').textContent=game.manual;
    el('command-content').hidden=activeMethod==='manual';
    el('manual-content').hidden=activeMethod!=='manual';
    el('depth-panel').hidden=!minecraftScript;
    if(gameChanged)renderSignals(game);
    if(activeMethod!=='manual'){
      el('terminal-title').textContent=method.terminal;
      el('prompt').textContent=method.prompt;
      showCommand();
      terminalBody.scrollTop=0;
      el('command-result').textContent=game.result;
      syncDepthCopy();
      const downloadPath=minecraftScript?'scripts/trace-pro-minecraft.ps1':method.download;
      el('download').href=downloadPath;
      el('download').download=downloadPath.split('/').pop();
      // The label rolls on hover: its copy (data-label) changes with the text.
      const downloadText=el('download').querySelector('.download-label > span'),downloadName=(minecraftScript?'Скачать TRACE-PRO .ps1':method.downloadLabel).replace(/\s*↓$/,'');
      downloadText.textContent=downloadName;downloadText.dataset.label=downloadName;
      el('download-context').textContent=minecraftScript
        ?'В скачиваемом .ps1 тот же сценарий: -Preset quick, system, minecraft или full задаёт глубину, -SkipIntro убирает заставку. JSON и CSV сохраняются на ПК только через пункт 5; перед отправкой отчёта проверьте, нет ли в нём личных данных.'
        :'Скачиваемый скрипт собирает общий список; команда выше ищет названия, характерные для выбранной игры.';
    }
  };
  if(!animated){apply();syncTerminalEdge();if(minecraftScript)depthDial.place(true);return;}
  morphHeight(panel,apply);
  syncTerminalEdge();
  TraceMotion.scramble(el('tool-kicker'),`Шаг 3 · ${method.kicker}`);
  TraceMotion.scramble(el('tool-title'),method.title,{duration:520});
  if(minecraftScript)depthDial.place(true);
  const content=activeMethod==='manual'?[el('manual-content')]:[minecraftScript?el('depth-panel'):null,el('terminal-title'),terminalBody,el('command-result')];
  materialize([el('tool-description'),...content,gameChanged?document.querySelector('.signal-panel'):null],{stagger:38});
}

function syncDepthCopy(){
  if(!isMinecraftScript()){el('command-scope').textContent='Команда только читает выбранные данные';return;}
  el('command-scope').textContent=depthMenuOn
    ?'Данные остаются на ПК · отчёт создаётся только через пункт 5'
    :`Глубина: ${depthLevels[depthIndex].title} · затем меню, где пункт 5 сохраняет отчёт`;
}

const depthDial=(()=>{
  const panel=el('depth-panel'),track=el('depth-track'),rail=track.querySelector('.depth-rail');
  const thumb=track.querySelector('.depth-thumb'),fill=track.querySelector('.depth-fill');
  const stops=[...track.querySelectorAll('.depth-stop')],menuButton=el('depth-menu');
  const list=el('depth-sources'),last=depthLevels.length-1;
  const items=new Map(depthSources.map(([key,title,note],index)=>{
    const li=document.createElement('li');li.dataset.source=key;li.style.setProperty('--i',index);
    li.innerHTML='<span class="depth-source-dot" aria-hidden="true"></span><span class="depth-source-copy"><strong></strong><small></small></span>';
    li.querySelector('strong').textContent=title;li.querySelector('small').textContent=note;
    list.append(li);return [key,li];
  }));
  let dragging=false,moved=false,startX=0;
  const motion=new Motion({
    p:new Spring({duration:.5,bounce:.3,value:depthIndex,precision:.0005}),
    s:new Spring({duration:.34,bounce:.42,value:1,precision:.0005})
  },({p,s},m)=>{
    const width=rail.clientWidth,x=p/last*width,v=m?.springs?.p.v??0;
    const stretch=Math.min(.35,Math.abs(v)*.05);
    thumb.style.transform=`translate3d(${x.toFixed(2)}px,0,0) scale(${(s*(1+stretch)).toFixed(4)},${(s*(1-stretch*.45)).toFixed(4)})`;
    fill.style.transform=`scaleX(${(Math.max(0,Math.min(width,x))/Math.max(1,width)).toFixed(4)})`;
    stops.forEach((stop,index)=>stop.classList.toggle('is-passed',p>=index-.04));
  });
  const railPosition=clientX=>{
    const box=rail.getBoundingClientRect();
    let raw=(clientX-box.left)/Math.max(1,box.width)*last;
    // Rubber band past either end, like an iOS scroll edge.
    if(raw<0)raw=-(1-1/(1-raw*.9))*.6;
    if(raw>last)raw=last+(1-1/(1+(raw-last)*.9))*.6;
    return raw;
  };
  function paintSources(animated){
    const info=currentDepthInfo(),on=new Set(info.sources);
    let wave=0;
    for(const [key,li] of items){
      const next=depthMenuOn?'optional':on.has(key)?'on':'off';
      if(li.dataset.state===next)continue;
      li.dataset.state=next;
      if(animated&&next==='on')animate(li,[{transform:'translateY(6px) scale(.96)',filter:'brightness(2.2)'},{transform:'none',filter:'brightness(1)'}],{spring:'bouncy',delay:wave++*45,fill:'none'});
    }
  }
  function commit(index,{animated=true,fromMenu=false}={}){
    index=Math.max(0,Math.min(last,index));
    const changed=index!==depthIndex||(depthMenuOn&&!fromMenu);
    depthIndex=index;
    if(!fromMenu&&depthMenuOn){depthMenuOn=false;menuButton.setAttribute('aria-pressed','false');panel.classList.remove('is-menu');}
    const level=depthLevels[depthIndex],info=currentDepthInfo();
    track.setAttribute('aria-valuenow',String(depthIndex+1));
    track.setAttribute('aria-valuetext',`${level.title}, ${level.time}`);
    stops.forEach((stop,i)=>stop.classList.toggle('is-current',i===depthIndex&&!depthMenuOn));
    if(animated&&changed){
      TraceMotion.scramble(el('depth-title'),info.title,{duration:420});
      TraceMotion.scramble(el('depth-time'),info.time,{duration:380});
      animate(stops[depthIndex].querySelector('i'),[{transform:'scale(1)'},{transform:'scale(1.9)'},{transform:'scale(1)'}],{duration:520,easing:'cubic-bezier(.22,1,.36,1)',fill:'none'});
    }else{el('depth-title').textContent=info.title;el('depth-time').textContent=info.time;}
    el('depth-summary').textContent=info.summary;
    paintSources(animated);
    if(changed&&isMinecraftScript()){showCommand({flash:animated});syncDepthCopy();syncTerminalEdge();}
  }
  track.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    dragging=true;moved=false;startX=event.clientX;
    track.setPointerCapture(event.pointerId);track.classList.add('is-dragging');
    motion.to({s:1.22,p:railPosition(event.clientX)},{config:{p:[.3,.12]}});
  });
  track.addEventListener('pointermove',event=>{
    if(!dragging)return;
    if(Math.abs(event.clientX-startX)>3)moved=true;
    const raw=railPosition(event.clientX);
    motion.to({p:raw},{config:{p:[.26,.1]}});
    const nearest=Math.round(Math.max(0,Math.min(last,raw)));
    if(nearest!==depthIndex||depthMenuOn)commit(nearest);
  });
  const release=event=>{
    if(!dragging)return;
    dragging=false;track.classList.remove('is-dragging');
    const nearest=Math.round(Math.max(0,Math.min(last,railPosition(event.clientX))));
    commit(nearest);
    motion.to({s:1,p:nearest},{config:{p:[.5,.32]}});
  };
  track.addEventListener('pointerup',release);
  track.addEventListener('pointercancel',release);
  track.addEventListener('keydown',event=>{
    const keys={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1};
    let next=null;
    if(event.key in keys)next=depthIndex+keys[event.key];
    if(event.key==='Home')next=0;
    if(event.key==='End')next=last;
    if(next===null)return;
    event.preventDefault();
    commit(next);
    motion.to({p:depthIndex,s:1},{config:{p:[.5,.32]}});
  });
  menuButton.addEventListener('click',()=>{
    depthMenuOn=!depthMenuOn;
    menuButton.setAttribute('aria-pressed',String(depthMenuOn));
    panel.classList.toggle('is-menu',depthMenuOn);
    stops.forEach((stop,i)=>stop.classList.toggle('is-current',i===depthIndex&&!depthMenuOn));
    const info=currentDepthInfo();
    TraceMotion.scramble(el('depth-title'),info.title,{duration:420});
    TraceMotion.scramble(el('depth-time'),info.time,{duration:380});
    el('depth-summary').textContent=info.summary;
    paintSources(true);
    showCommand({flash:true});syncDepthCopy();syncTerminalEdge();
  });
  new ResizeObserver(()=>motion.render(motion.values,motion)).observe(rail);
  commit(depthIndex,{animated:false});
  return {
    place(immediate){motion.to({p:depthIndex},{immediate});},
    // Deep links: check.html?depth=quick|system|minecraft|full|menu
    set(key){
      const index=depthLevels.findIndex(level=>level.key===key);
      if(index>=0){commit(index,{animated:false});motion.to({p:depthIndex},{immediate:true});}
      if(key==='menu'){depthMenuOn=true;menuButton.setAttribute('aria-pressed','true');panel.classList.add('is-menu');commit(depthIndex,{animated:false,fromMenu:true});}
    }
  };
})();

/* ───── Game list: the trigger's capsule itself opens into the list ─────
   At rest the glass is the capsule behind the trigger. Opening pours it out
   and down around the trigger row, which stays as the header; rows surface
   as the glass reaches them. Closing flows it back into the capsule. */
const gamePicker=document.querySelector('.game-picker');
const gameSelect=document.querySelector('.game-select');
const gameTrigger=el('game-trigger');
const gameValue=el('game-value');
const gameList=el('game-options');
const nativeGame=el('game');
gameList.classList.remove('game-options');gameList.classList.add('game-list');
const gameSurface=document.createElement('div');gameSurface.className='game-surface';
const gameGlass=document.createElement('div');gameGlass.className='game-glass';
const gameDivider=document.createElement('span');gameDivider.className='game-divider';gameDivider.setAttribute('aria-hidden','true');
const gameLensElement=document.createElement('span');gameLensElement.className='game-list-lens';gameLensElement.setAttribute('aria-hidden','true');
gameList.append(gameDivider,gameLensElement);
const gameFill=document.createElement('div');gameFill.className='morph-fill';gameFill.setAttribute('aria-hidden','true');
gameGlass.append(gameFill,gameList);gameSurface.append(gameGlass);gameSelect.prepend(gameSurface);
const checkIcon='<svg class="glyph" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3.8 8.4 2.7 2.7 5.7-6.2"/></svg>';
const gameOptionNodes=[...nativeGame.options].map((nativeOption,index)=>{
  const option=document.createElement('div');
  option.id=`game-option-${index}`;option.className='game-option';option.setAttribute('role','option');
  option.dataset.value=nativeOption.value;
  option.innerHTML=`<span class="game-option-label"></span><span class="game-option-check" aria-hidden="true">${checkIcon}</span>`;
  option.querySelector('.game-option-label').textContent=nativeOption.textContent;
  option.addEventListener('pointerdown',event=>event.preventDefault());
  option.addEventListener('pointermove',()=>{if(activeGameOption!==index)setActiveGameOption(index);});
  option.addEventListener('click',()=>chooseGame(index));
  gameList.append(option);
  return option;
});
const gameLens=new Lens(gameList,gameLensElement,{duration:.42,bounce:.2});
let activeGameOption=0,typeahead='',typeaheadTimer,gameOpen=false,gameRows=[],gameDir=1;

function syncGameChoice(){
  gameValue.textContent=nativeGame.selectedOptions[0].textContent;
  gameOptionNodes.forEach((option,index)=>{
    const selected=option.dataset.value===nativeGame.value;
    option.setAttribute('aria-selected',String(selected));
    option.classList.toggle('is-selected',selected);
    if(selected)activeGameOption=index;
  });
}
function setActiveGameOption(index,{immediate=false}={}){
  activeGameOption=(index+gameOptionNodes.length)%gameOptionNodes.length;
  const active=gameOptionNodes[activeGameOption];
  gameOptionNodes.forEach(option=>option.classList.toggle('is-active',option===active));
  if(gameOpen)gameTrigger.setAttribute('aria-activedescendant',active.id);
  gameLens.moveTo(active,{immediate});
}

const gameMorph=new Morph({body:gameGlass,content:gameList,
  onFrame:({t,b,c})=>{
    const target=gameMorph.target;
    // How far the glass has opened past the header row, measured from the trigger.
    const reach=gameDir>0?b-target.y:target.y+target.h-t;
    gameDivider.style.opacity=(smooth(4,20,reach-gameTrigger.offsetHeight)*c).toFixed(3);
    gameRows.forEach((row,index)=>{
      const option=gameOptionNodes[index];
      const near=gameDir>0?row.top:target.h-row.bottom;
      const reveal=Math.min(smooth(near+10,near+42,reach),c),style=option.style;
      if(reveal>.995){style.opacity=style.translate=style.scale=style.filter='';return;}
      style.opacity=reveal.toFixed(3);
      style.translate=`0 ${((1-reveal)*-6*gameDir).toFixed(2)}px`;
      style.scale=(.97+.03*reveal).toFixed(4);
      style.filter=`blur(${((1-reveal)*3).toFixed(2)}px)`;
    });
    gameList.classList.toggle('is-lit',c>.6);
  },
  onRest:open=>{if(!open){gameList.hidden=true;gameSurface.classList.remove('is-open','is-up');}}
});

function layoutGame(){
  const W=gameTrigger.offsetWidth,H=gameTrigger.offsetHeight,pad=6;
  const hidden=gameList.hidden;gameList.hidden=false;
  gameList.style.width=`${W+pad*2}px`;
  gameList.style.paddingTop=gameList.style.paddingBottom='';
  const L=gameList.offsetHeight;
  gameDir=innerHeight-gameTrigger.getBoundingClientRect().bottom>=L+30?1:-1;
  // Leave room in the list for the trigger row, which stays on top of the glass.
  if(gameDir>0)gameList.style.paddingTop=`${H+pad+4}px`;else gameList.style.paddingBottom=`${H+pad+4}px`;
  const total=gameList.offsetHeight;
  gameRows=gameOptionNodes.map(option=>({top:option.offsetTop,bottom:option.offsetTop+option.offsetHeight}));
  gameDivider.style.top=gameDir>0?`${H+pad+1}px`:`${total-H-pad-2}px`;
  gameList.hidden=hidden;
  gameMorph.layout({x:0,y:0,w:W,h:H,r:17},gameDir>0?{x:-pad,y:-pad,w:W+pad*2,h:total,r:22}:{x:-pad,y:H+pad-total,w:W+pad*2,h:total,r:22});
}
new ResizeObserver(()=>{if(!gameOpen){layoutGame();gameMorph.snap(false);}}).observe(gameTrigger);

function openGameOptions(move=0){
  if(!gameOpen){
    gameOpen=true;
    syncGameChoice();
    layoutGame();
    gameList.hidden=false;
    gameSurface.classList.add('is-open');
    gameSurface.classList.toggle('is-up',gameDir<0);
    gameTrigger.setAttribute('aria-expanded','true');
    setActiveGameOption(activeGameOption,{immediate:true});
    gameMorph.set(true);
  }
  if(move)setActiveGameOption(activeGameOption+move);
  gameTrigger.setAttribute('aria-activedescendant',gameOptionNodes[activeGameOption].id);
}
function closeGameOptions(returnFocus=false){
  if(!gameOpen)return;
  gameOpen=false;
  gameTrigger.setAttribute('aria-expanded','false');
  gameTrigger.removeAttribute('aria-activedescendant');
  gameOptionNodes.forEach(option=>option.classList.remove('is-active'));
  gameSurface.classList.remove('is-open');
  if(returnFocus)gameTrigger.focus({preventScroll:true});
  gameMorph.set(false);
}
// Drawn once, invisibly, at idle: the first open then finds its GPU programs already built.
window.TraceUI?.warm(()=>{
  const select=document.createElement('div');select.className='game-select';
  select.style.cssText='position:absolute;left:40px;top:60px;height:50px';
  const surface=gameSurface.cloneNode(true);
  surface.classList.add('is-open');
  surface.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
  Object.assign(surface.querySelector('.game-glass').style,{left:'-6px',top:'-6px',width:'248px',height:'208px',borderRadius:'22px'});
  const list=surface.querySelector('.game-list');list.hidden=false;list.style.transform='none';
  list.querySelectorAll('.game-option').forEach(option=>{option.style.opacity='.6';option.style.filter='blur(1px)';});
  select.append(surface);
  return select;
});
window.TraceUI?.warm(()=>{
  const panel=document.createElement('div');panel.className='trace-panel is-open is-settled';
  panel.innerHTML=el('guide').innerHTML;
  panel.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
  return panel;
});
// The capsule gives under a press and springs back.
const gamePress=new Motion({p:new Spring({duration:.3,bounce:.45,precision:.002})},({p})=>{
  gameGlass.style.scale=Math.abs(p)<.002?'':`${(1-.025*p).toFixed(4)} ${(1-.05*p).toFixed(4)}`;
});
gameTrigger.addEventListener('pointerdown',event=>{if(event.button===0&&!gameOpen)gamePress.to({p:1},{config:{p:[.2]}});});
for(const type of ['pointerup','pointerleave','pointercancel'])gameTrigger.addEventListener(type,()=>gamePress.to({p:0},{config:{p:[.42,.5]}}));
gameSelect.addEventListener('pointermove',event=>{
  if(event.pointerType!=='mouse')return;
  const box=gameGlass.getBoundingClientRect();
  gameSurface.style.setProperty('--glass-x',`${(event.clientX-box.left).toFixed(1)}px`);
  gameSurface.style.setProperty('--glass-y',`${(event.clientY-box.top).toFixed(1)}px`);
},{passive:true});
function chooseGame(index){
  const option=gameOptionNodes[index];
  if(option.dataset.value!==nativeGame.value){
    const previous=nativeGame.selectedIndex;
    nativeGame.value=option.dataset.value;
    swapText(gameValue.parentElement,gameValue,nativeGame.selectedOptions[0].textContent,index>previous?1:-1);
    nativeGame.dispatchEvent(new Event('change',{bubbles:true}));
  }
  closeGameOptions(true);
}
gameTrigger.addEventListener('click',()=>gameOpen?closeGameOptions():openGameOptions());
gameTrigger.addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();
    const step=event.key==='ArrowDown'?1:-1;
    if(gameOpen)setActiveGameOption(activeGameOption+step);else openGameOptions();
    gameTrigger.setAttribute('aria-activedescendant',gameOptionNodes[activeGameOption].id);
    return;
  }
  if(event.key==='Home'||event.key==='End'){
    event.preventDefault();if(!gameOpen)openGameOptions();
    setActiveGameOption(event.key==='Home'?0:gameOptionNodes.length-1);return;
  }
  if(event.key==='Enter'||event.key===' '){
    event.preventDefault();
    if(!gameOpen)openGameOptions();else chooseGame(activeGameOption);
    return;
  }
  if(event.key==='Escape'&&gameOpen){event.preventDefault();event.stopPropagation();closeGameOptions(true);return;}
  if(event.key==='Tab'&&gameOpen)closeGameOptions();
  if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
    typeahead+=event.key.toLocaleLowerCase();clearTimeout(typeaheadTimer);
    typeaheadTimer=setTimeout(()=>{typeahead='';},700);
    const index=gameOptionNodes.findIndex(option=>option.querySelector('.game-option-label').textContent.toLocaleLowerCase().startsWith(typeahead));
    if(index>=0){if(!gameOpen)openGameOptions();setActiveGameOption(index);}
  }
});
document.addEventListener('pointerdown',event=>{if(gameOpen&&!gameSelect.contains(event.target))closeGameOptions();});
gamePicker.addEventListener('focusout',()=>requestAnimationFrame(()=>{if(!gamePicker.contains(document.activeElement))closeGameOptions();}));
el('game-label').addEventListener('click',()=>{gameTrigger.focus();openGameOptions();});
nativeGame.addEventListener('change',()=>{syncGameChoice();renderSelection();});
gameList.addEventListener('pointerleave',()=>{if(gameOpen)setActiveGameOption(nativeGame.selectedIndex);});

/* ───── Method tabs: one glass lens glides between them ───── */
const tabLens=new Lens(document.querySelector('.tool-tabs'),document.querySelector('.tab-lens'),{duration:.5,bounce:.2});
function selectMethod(key,{focus=false,animated=true}={}){
  if(!methods[key])return false;
  const changed=activeMethod!==key||!animated;
  activeMethod=key;
  document.body.dataset.terminalMode=key;
  tabs.forEach(tab=>{
    const selected=tab.dataset.tool===key;
    tab.setAttribute('aria-selected',String(selected)); tab.tabIndex=selected?0:-1;
    if(selected){tabLens.moveTo(tab,{immediate:!animated});if(focus)tab.focus();}
  });
  el('tool-panel').setAttribute('aria-labelledby',`tab-${key}`);
  if(changed)renderSelection({animated});
  return true;
}
tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>selectMethod(tab.dataset.tool));
  tab.addEventListener('keydown',event=>{
    let next;
    if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%tabs.length;
    if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index+tabs.length-1)%tabs.length;
    if(event.key==='Home')next=0;
    if(event.key==='End')next=tabs.length-1;
    if(next!==undefined){event.preventDefault();selectMethod(tabs[next].dataset.tool,{focus:true});}
  });
});

/* ───── Copy: local confirmation on the control, global one in the island ───── */
const copyButton=el('copy');
const copyLabel=copyButton.querySelector('.copy-label');
let copyTimer;
// The button keeps the width of its longest label (set once), so the labels swap in place and nothing is resized.
function setCopyLabel(text,direction){
  if(!copyButton.style.minWidth)copyButton.style.minWidth=`${Math.ceil(copyButton.getBoundingClientRect().width)}px`;
  swapText(copyLabel.parentElement,copyLabel,text,direction);
}
function confirmCopy(){
  clearTimeout(copyTimer);
  copyButton.classList.add('is-copied');
  setCopyLabel('Скопировано',1);
  const terminal=el('terminal');
  terminal.classList.remove('is-captured');void terminal.offsetWidth;terminal.classList.add('is-captured');
  TraceUI.notify({title:'Команда скопирована',detail:'Проверьте её перед запуском'});
  copyTimer=setTimeout(()=>{copyButton.classList.remove('is-copied');setCopyLabel('Скопировать команду',-1);},2400);
}
el('terminal').addEventListener('animationend',event=>{if(event.pseudoElement==='::after')el('terminal').classList.remove('is-captured');});
copyButton.addEventListener('click',async()=>{
  const gameKey=el('game').value;
  const key=selectionKey(activeMethod,gameKey);
  const value=shownCommand||currentCommand();
  try{
    await navigator.clipboard.writeText(value);
    // The intro art runs once: the next time this game and method are shown, the command comes without it. The
    // terminal is not redrawn now, so the page keeps showing what is in the clipboard.
    shownWithoutIntro.add(key);
    confirmCopy();
  }catch{
    const range=document.createRange(); range.selectNodeContents(el('command'));
    const selection=window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    TraceUI.notify({title:'Команда выделена',detail:'Нажмите Ctrl+C, чтобы скопировать'});
  }
});

el('instructions').addEventListener('click',event=>{
  const method=methods[activeMethod],game=games[el('game').value];
  const tracePro=activeMethod==='powershell'&&el('game').value==='minecraft';
  el('guide-title').textContent=activeMethod==='cmd'?'Как запустить проверку в CMD':'Как запустить проверку в PowerShell';
  el('guide-body').innerHTML=tracePro?methods.powershellMinecraft.guide:method.guide;
  if(tracePro){
    const report=document.createElement('p');
    report.textContent='В сценарии для Minecraft пункт 5 сохраняет отчёт в JSON и CSV, если вы его выберете. В отчёте могут быть личные пути, имя пользователя и аргументы Java (ключ сессии и идентификаторы учётной записи в них заменены звёздочками): откройте файлы и проверьте их, прежде чем отправлять.';
    const depth=document.createElement('p');const info=currentDepthInfo();
    depth.textContent=depthMenuOn
      ?'Выбрано «Меню в терминале»: после заставки TRACE-PRO спросит режим проверки.'
      :`Выбрана глубина «${info.title}» (${info.time}): проверка начнётся сразу, затем откроется меню для сохранения отчёта или выхода.`;
    el('guide-body').append(depth,report);
  }
  const context=document.createElement('p'); context.textContent=game.manual; el('guide-body').append(context);
  TraceUI.openDialog(el('guide'),event.currentTarget);
});

el('export-checklist').addEventListener('click',()=>{
  const lines=[...document.querySelectorAll('.manual-list label')].map(label=>`[${label.querySelector('input').checked?'x':' '}] ${label.querySelector('.check-text').textContent}`);
  const report='\ufeffTrace, ручная проверка\r\nДата: '+new Date().toLocaleString('ru-RU')+' (местное время)'+'\r\nИгра: '+el('game').selectedOptions[0].textContent+'\r\n\r\n'+lines.join('\r\n')+'\r\n\r\n'+games[el('game').value].manual+'\r\n\r\nЭто отметки пользователя, а не автоматический вывод о нарушении.\r\n';
  const url=URL.createObjectURL(new Blob([report],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='TRACE-checklist.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  TraceUI.notify({title:'Чек-лист подготовлен',detail:'Файл TRACE-checklist.txt сохраняется'});
});

const initial=new URLSearchParams(location.search);
// Only real choices from the address: not inherited keys like toString or __proto__, not the internal TRACE-PRO guide.
const wantedGame=initial.get('game'),wantedMethod=initial.get('method');
if(Object.hasOwn(games,wantedGame))el('game').value=wantedGame;
depthDial.set(initial.get('depth'));
syncGameChoice();
selectMethod(['powershell','cmd','manual'].includes(wantedMethod)?wantedMethod:'powershell',{animated:false});

if(navigator.modelContext?.registerTool){
  navigator.modelContext.registerTool({name:'select_check_method',description:'Select a TRACE instruction method and game. This only changes the visible page; it does not execute commands or read the computer.',inputSchema:{type:'object',properties:{method:{type:'string',enum:['powershell','cmd','manual']},game:{type:'string',enum:['minecraft','gta','cs2']}},required:['method'],additionalProperties:false},execute:async({method,game})=>{if(!methods[method]||(game&&!games[game]))throw new Error('Unknown method or game');if(game){el('game').value=game;syncGameChoice();renderSelection();}selectMethod(method);return{content:[{type:'text',text:methods[method].title}]}}});
}
