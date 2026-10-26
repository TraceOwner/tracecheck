#requires -Version 5.1
<#
TRACE-PRO: локальная проверка следов Minecraft.
Запуск: .\trace-pro-minecraft.ps1
Только заставка: .\trace-pro-minecraft.ps1 -AnimationOnly
Без заставки: .\trace-pro-minecraft.ps1 -SkipIntro
Глубина сразу: .\trace-pro-minecraft.ps1 -Preset quick|system|minecraft|full
  quick     — все процессы, аргументы JVM, DLL в Java и Prefetch
  system    — quick + службы, журналы, реестр, Defender, автозапуск, корзина, hosts
  minecraft — system + папки лаунчеров, рабочий стол, «Загрузки» и пакеты внутри JAR
  full      — system + все диски и флешки с JAR (долго)
  menu      — меню выбора режима (по умолчанию)
Ничего не удаляет и не отправляет в сеть. Отчёт сохраняется через пункт 5.
Совпадения имён и эвристики требуют ручной проверки.
#>
[CmdletBinding()]
param([switch]$SkipIntro, [switch]$AnimationOnly, [ValidateSet('menu','quick','system','minecraft','full')][string]$Preset = 'menu')

& {
    $ErrorActionPreference = 'Continue'

    # TRACE_INTRO_START (omitted from the shorter paste variant)
    $reaperArt = @(
        '            ...',
        '           ;::::;',
        '         ;::::; :;',
        '       ;:::::''   :;',
        '      ;:::::;     ;.',
        '     ,:::::''       ;           OOO\',
        '     ::::::;       ;          OOOOO\',
        '     ;:::::;       ;         OOOOOOOO',
        '    ,;::::::;     ;''        / OOOOOOO',
        '  ;:::::::::`. ,,,;.       /  / DOOOOOO',
        '.'';:::::::::::::::::;,    /  /     DOOOO',
        ',::::::;::::::;;;;::::;,  /  /        DOOO',
        ';`::::::`''::::::;;;::::: ,#/  /          DOOO',
        ':`:::::::`;::::::;;::: ;::#  /            DOOO',
        '::`:::::::`;:::::::: ;::::# /              DOO',
        '`:`:::::::`;:::::: ;::::::#/               DOO',
        ' :::`:::::::`;; ;:::::::::##                OO',
        ' ::::`:::::::`;::::::::;:::#                OO',
        ' `:::::`::::::::::::;''`:;::#                O',
        '  `:::::`::::::::;'' /  / `:#',
        '   ::::::`:::::;''  /  /   `#'
    )

    $reaperColors = @(
        'DarkGray', 'DarkGray', 'Gray', 'Gray', 'Gray',
        'Gray', 'Gray', 'Gray', 'Gray', 'Gray',
        'Gray', 'Gray', 'Gray', 'Gray', 'Gray',
        'DarkGray', 'DarkGray', 'DarkGray', 'DarkGray', 'DarkGray', 'DarkGray'
    )

    function New-ReaperFrame {
        param([double]$Drop = 0)
        $width = 50; $height = 27
        $rows = New-Object 'System.Collections.Generic.List[string]'
        for ($y = 0; $y -lt $height; $y++) {
            $line = [Text.StringBuilder]::new($width)
            for ($x = 0; $x -lt $width; $x++) {
                # Inverse mapping preserves the original sleeve texture and fills
                # the moving arm contour without drawing extra stick arms.
                $weight = [Math]::Max(0.0, [Math]::Min(1.0, ($x - 8.0) / 18.0))
                $weight = $weight * $weight * (3.0 - 2.0 * $weight)
                $shift = $Drop * $weight
                $sourceY = [double]$y
                if ($y -gt 10) {
                    if ($y -lt (13 + $shift)) {
                        $sourceY = 10.0 + ($y - 10.0) * 3.0 / (3.0 + $shift)
                    } else { $sourceY = $y - $shift }
                }
                $sy = [int][Math]::Floor($sourceY + 0.5)
                $ch = ' '
                if ($sy -ge 0 -and $sy -lt $reaperArt.Count -and $x -lt $reaperArt[$sy].Length) {
                    $candidate = $reaperArt[$sy][$x]
                    # Include both lower diagonal shaft edges (columns 19..23).
                    # '#' and punctuation belong to the original hand/sleeve.
                    if ('OD/\'.IndexOf($candidate) -lt 0) { $ch = [string]$candidate }
                }
                [void]$line.Append($ch)
            }
            $rows.Add($line.ToString())
        }
        # Rigid weapon: original characters, same shape, downward translation only.
        $weaponOffset = [int][Math]::Floor($Drop + 0.5)
        for ($r = 0; $r -lt $reaperArt.Count; $r++) {
            for ($c = 0; $c -lt $reaperArt[$r].Length; $c++) {
                $ch = $reaperArt[$r][$c]
                if ('OD/\'.IndexOf($ch) -lt 0) { continue }
                $targetR = $r + $weaponOffset
                if ($targetR -ge $height) { continue }
                $chars = $rows[$targetR].ToCharArray()
                # Original sleeve occludes the handle, as it did in the source art.
                if ($chars[$c] -eq ' ') { $chars[$c] = $ch }
                $rows[$targetR] = -join $chars
            }
        }
        return $rows.ToArray()
    }

    function ConvertTo-ReaperViewport {
        param([string[]]$Lines, [int]$WindowWidth, [int]$WindowHeight, [bool]$UseAnsi)
        # Keep the final column/row unused: console autowrap must not scroll.
        $canvasW = [Math]::Max(1, $WindowWidth - 1)
        $canvasH = [Math]::Max(1, $WindowHeight - 1)
        # Common bounds for the whole motion, including the lowered scythe.
        $sourceW = 46; $sourceH = 25
        $scale = [Math]::Min($canvasW / [double]$sourceW, $canvasH / [double]$sourceH)
        $drawW = [Math]::Max(1, [int][Math]::Floor($sourceW * $scale))
        $drawH = [Math]::Max(1, [int][Math]::Floor($sourceH * $scale))
        $padX = 0
        $padY = [int][Math]::Floor(($canvasH - $drawH) / 2.0)
        $blank = ' ' * $canvasW
        $esc = [string][char]27
        $rows = New-Object 'System.Collections.Generic.List[string]'
        $scaledRows = @{}
        # Scale the existing characters; no new artwork or terminal font changes.
        for ($y = 0; $y -lt $canvasH; $y++) {
            if ($y -lt $padY -or $y -ge ($padY + $drawH)) {
                $rows.Add($blank)
                continue
            }
            $sy = [Math]::Min($sourceH - 1, [int][Math]::Floor(($y - $padY) * $sourceH / [double]$drawH))
            if (-not $scaledRows.ContainsKey($sy)) {
                $line = [Text.StringBuilder]::new($canvasW + 8)
                if ($UseAnsi) {
                    $code = if ($sy -lt 2 -or $sy -ge 16) { '90' } else { '37' }
                    [void]$line.Append($esc + '[' + $code + 'm')
                }
                [void]$line.Append(' ' * $padX)
                # Replicate each source character in a run; only 46 iterations
                # per source row, even on a very large fullscreen terminal.
                for ($sx = 0; $sx -lt $sourceW; $sx++) {
                    $start = [int][Math]::Ceiling($sx * $drawW / [double]$sourceW)
                    $end = [int][Math]::Ceiling(($sx + 1) * $drawW / [double]$sourceW)
                    if ($end -gt $start) { [void]$line.Append([char]$Lines[$sy][$sx], ($end - $start)) }
                }
                [void]$line.Append(' ' * ($canvasW - $padX - $drawW))
                $scaledRows[$sy] = $line.ToString()
            }
            $rows.Add($scaledRows[$sy])
        }
        $frame = $rows -join "`r`n"
        if ($UseAnsi) { $frame += $esc + '[0m' }
        return $frame
    }

    function Show-ReaperIntro {
        if ($Host.Name -ne 'ConsoleHost' -or [Console]::IsOutputRedirected -or [Console]::IsInputRedirected) {
            foreach ($line in $reaperArt) { Write-Host $line -ForegroundColor White }
            return
        }
        $savedCursor = $true; $rendered = $false
        $savedColor = [Console]::ForegroundColor
        $useAnsi = [bool]$Host.UI.SupportsVirtualTerminal
        $esc = [string][char]27
        try {
            try { $savedCursor = [Console]::CursorVisible } catch {}
            $sourceFrames = New-Object 'System.Collections.Generic.List[object]'
            for ($i = 0; $i -le 36; $i++) {
                $t = $i / 36.0
                $ease = $t * $t * (3.0 - 2.0 * $t)
                $sourceFrames.Add([pscustomobject]@{ Lines = @(New-ReaperFrame -Drop (4.0 * $ease)) })
            }
            $width = 0; $height = 0; $last = -1
            $timer = [Diagnostics.Stopwatch]::StartNew()
            while ($timer.Elapsed.TotalSeconds -lt 2.2) {
                if ([Console]::KeyAvailable) { [void][Console]::ReadKey($true); break }
                $newWidth = [Console]::WindowWidth; $newHeight = [Console]::WindowHeight
                if ($newWidth -lt 2 -or $newHeight -lt 2) { Start-Sleep -Milliseconds 30; continue }
                if ($newWidth -ne $width -or $newHeight -ne $height) {
                    # A resize pauses the clock, rebuilds the viewport and resumes
                    # the same pose. Maximizing no longer aborts the animation.
                    $timer.Stop()
                    $width = $newWidth; $height = $newHeight
                    $frames = New-Object 'System.Collections.Generic.List[string]'
                    foreach ($source in $sourceFrames) {
                        $frames.Add((ConvertTo-ReaperViewport -Lines $source.Lines -WindowWidth $width -WindowHeight $height -UseAnsi $useAnsi))
                    }
                    Clear-Host
                    $rendered = $true
                    [Console]::CursorVisible = $false
                    [Console]::ForegroundColor = [ConsoleColor]::Gray
                    $last = -1
                    $timer.Start()
                    # Recheck dimensions in case they changed during preparation.
                    continue
                }
                $index = [Math]::Max(0, [Math]::Min(36, [int][Math]::Floor(($timer.Elapsed.TotalSeconds - 0.35) * 30)))
                if ($index -ne $last) {
                    [Console]::SetCursorPosition([Console]::WindowLeft, [Console]::WindowTop)
                    [Console]::Write($frames[$index])
                    $last = $index
                }
                Start-Sleep -Milliseconds 8
            }
        } catch {
            Write-Verbose ('Заставка: ' + $_.Exception.Message)
        } finally {
            try {
                if ($useAnsi) { [Console]::Write($esc + '[0m') }
                [Console]::ForegroundColor = $savedColor
                [Console]::CursorVisible = $savedCursor
                if ($rendered) {
                    [Console]::SetCursorPosition([Console]::WindowLeft, [Console]::WindowTop + [Console]::WindowHeight - 1)
                }
            } catch {}
        }
    }

    if (-not $SkipIntro) { Show-ReaperIntro }
    if ($AnimationOnly) { return }
    # TRACE_INTRO_END
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
        Write-Error 'Проверка системы доступна только в Windows.'
        return
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction Stop

    # TRACE_TITLE_START (omitted from the shorter paste variant)
    if (-not $SkipIntro) {
    Clear-Host
    Write-Host ""
    $titleLines = @(
        " ████████╗██████╗   █████╗   ██████╗███████╗    ██████╗ ██████╗   ██████╗ ",
        " ╚══██╔══╝██╔══██╗ ██╔══██╗ ██╔════╝██╔════╝    ██╔══██╗██╔══██╗ ██╔═══██╗",
        "    ██║   ██████╔╝ ███████║ ██║     █████╗      ██████╔╝██████╔╝ ██║   ██║",
        "    ██║   ██╔══██╗ ██╔══██║ ██║     ██╔══╝      ██╔═══╝ ██╔══██╗ ██║   ██║",
        "    ██║   ██║  ██║ ██║  ██║ ╚██████╗███████╗    ██║     ██║  ██║ ╚██████╔╝",
        "    ╚═╝   ╚═╝  ╚═╝ ╚═╝  ╚═╝  ╚═════╝╚══════╝    ╚═╝     ╚═╝  ╚═╝  ╚═════╝ "
    )
    $titleColors = @('DarkGray', 'Gray', 'Gray', 'White', 'Gray', 'DarkGray')

    for ($i = 0; $i -lt $titleLines.Count; $i++) {
        Write-Host ("  " + $titleLines[$i]) -ForegroundColor $titleColors[$i]
    }

    Write-Host "  ─────────────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "   [>] TRACE-PRO: локальная проверка Minecraft" -ForegroundColor White
    Write-Host "  ─────────────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray

    Start-Sleep -Milliseconds 350

    Clear-Host
    }
    # TRACE_TITLE_END

    Write-Host "  ─────────────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "   TRACE-PRO: проверка этого компьютера" -ForegroundColor White
    Write-Host "   Хост: $env:COMPUTERNAME | Пользователь: $env:USERNAME | Дата: $(Get-Date -Format 'dd.MM.yyyy HH:mm:ss')" -ForegroundColor DarkGray
    Write-Host "  ─────────────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray

    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Host "  [!] Сценарий запущен без прав администратора." -ForegroundColor Yellow
        Write-Host "      Доступ к BAM, Prefetch, EventLog и системным журналам будет ограничен." -ForegroundColor Yellow
        Write-Host "      Чтобы проверить всё, запустите PowerShell от имени администратора.`n" -ForegroundColor DarkYellow
    } else {
        Write-Host "  [*] Привилегии: Администратор (некоторые источники всё равно могут быть недоступны)`n" -ForegroundColor Green
    }

    # База читов, инджектов, модов, программ для очистки следов и автокликеров (2024-2026)
    $cheatKeywords = @(
        # СНГ Анархия / FunTime / HolyWorld / ReallyWorld
        'nursultan', 'nurik', 'expensive', 'ex3', 'celestial', 'wild client', 'wildclient',
        'akrien', 'deadcode', 'rockstar', 'rockstar.jar', 'excellent', 'minced', 'deltadlc',
        'delta client', 'thunderhack', 'boze', 'alekdlc', 'alekclient', 'alek solution', 'alek.jar',
        'fluger', 'zamorozka', 'neverhook', 'vega', 'avalon', 'excat', 'xatz', 'freezclient',
        'flueclient', 'bebraclient', 'moonclient', 'exloader', 'nocturnal', 'rich client',
        'catlean', 'impact', 'inertiaclient', 'wburst',

        # Ghost / Hypixel / Practice
        'vape', 'vape v4', 'vapelite', 'drip', 'driplite', 'slinky', 'juul', 'kura',
        'raven', 'raven b+', 'raven bplus', 'raven xd', 'weave', 'neko', 'entropy',
        'dream', 'lowkey', 'whiteout', 'rise 6', 'rise client', 'tenacity', 'augustus',
        'liquidbounce', 'fdpclient', 'fdp client', 'meteor', 'meteor client', 'rusherhack', 'future client',
        'aristois', 'sapphire', 'haru', 'doomsday', 'prestige', 'crypt', 'antic',

        # Кликеры и макросы
        'autoclicker', 'mango clicker', 'ghostclicker', 'lunarclicker', 'viper clicker',
        'echo clicker', 'bape', 'opautoclicker', 'fastclicker', 'auto-clicker',

        # Программы для очистки следов и системные утилиты (утилиты — слабые совпадения)
        'echocleaner', 'oceancleaner', 'paladin', 'usnwipe', 'eventcleaner', 'recentcleaner',
        'shellbagscleaner', 'usbdeview', 'winprefetchview', 'processhacker', 'systeminformer',
        'cheatengine', 'x64dbg', 'dnspy',

        # Актуальные читы 2025-2026 (дополнительная база)
        'sigma client', 'sigmaclient', 'wurst client', 'wurstclient', 'salhack', 'kamiblue',
        'novoline', 'hyperium', 'matcha client', 'matchaclient', 'flux client', 'fluxclient',
        'wave client', 'waveclient', 'aurora client', 'yesclient', 'yes client',
        'atomic client', 'atomicclient', 'wither client', 'witherclient', 'zenith client',
        'zenithclient', 'venom client', 'venomclient', 'watermark remover',
        'spoofer', 'hwid spoofer', 'hwidspoofer'
    )

    # Общие слова, имена, другие программы и игры, а также системные утилиты: совпадение с ними —
    # находка низкой важности, и ищутся они только отдельным словом.
    $weakKeywords = @(
        'nurik', 'ex3', 'excellent', 'minced', 'vega', 'avalon', 'impact', 'rockstar', 'nocturnal',
        'vape', 'drip', 'slinky', 'juul', 'kura', 'raven', 'weave', 'neko', 'entropy', 'dream', 'lowkey',
        'whiteout', 'tenacity', 'augustus', 'meteor', 'sapphire', 'haru', 'doomsday', 'prestige', 'crypt',
        'antic', 'bape', 'paladin', 'usbdeview', 'winprefetchview', 'processhacker', 'systeminformer',
        'x64dbg', 'dnspy', 'hyperium', 'spoofer', 'watermark remover'
    )

    # Пакеты внутри .jar: имя ищется как папка пакета (ru/nursultan/...), а не как имя класса,
    # иначе класс Raven из мода Twilight Forest давал бы находку.
    $jarSignatures = @(
        'ru/nursultan', 'net/expensive', 'com/vape', 'celestial', 'deadcode',
        'akrien', 'thunderhack', 'slinky', 'liquidbounce', 'meteorclient',
        'rusherhack', 'futureclient', 'aristois', 'boze', 'minced', 'rockstar',
        'kura', 'raven', 'tenacity', 'augustus', 'zamorozka', 'neverhook'
    )

    $gameRoots = @(
        "$env:APPDATA\.minecraft",
        "$env:APPDATA\.tlauncher",
        "$env:USERPROFILE\.lunarclient",
        "$env:APPDATA\.lunarclient",
        "$env:USERPROFILE\.weave",
        "$env:APPDATA\.feather",
        "$env:APPDATA\PrismLauncher",
        "$env:APPDATA\PolyMC",
        "$env:APPDATA\MultiMC",
        "$env:APPDATA\ATLauncher",
        "$env:APPDATA\ModrinthApp",
        "$env:LOCALAPPDATA\Programs\gdlauncher_carbon",
        "$env:USERPROFILE\curseforge\minecraft\Instances",
        "$env:USERPROFILE\Downloads",
        "$env:LOCALAPPDATA\Temp"
    )
    # Рабочий стол и «Загрузки» берутся там, где они на самом деле (их переносят в OneDrive или на другой диск).
    $gameRoots += [Environment]::GetFolderPath('Desktop')
    try { $gameRoots += (New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path } catch {}
    $gameRoots = @($gameRoots | Where-Object { $_ } | Select-Object -Unique)

    $hits = New-Object 'System.Collections.Generic.List[object]'
    $stats = @{ FilesChecked = 0; DirectoriesChecked = 0; JarsChecked = 0; AccessErrors = 0 }
    $scanNotes = New-Object 'System.Collections.Generic.List[string]'
    $visited = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $hitKeys = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $reportState = @{ LastReport = $null }

    function Add-ScanNote([string]$message) {
        if (-not $scanNotes.Contains($message)) { $scanNotes.Add($message) }
    }
    function Invoke-TraceAudit([string]$name) {
        try { & $name } catch { Add-ScanNote ($name + ': ' + $_.Exception.Message) }
    }

    # Одно выражение на весь список. Отличительные названия ищутся как часть имени
    # (NursultanClient.jar, Expensive2.0.jar), общие слова — только отдельным словом:
    # иначе 'crypt' сработал бы на Encryption и CryptoPolicyTask.
    $strongTerms = @($cheatKeywords | Where-Object { $weakKeywords -notcontains $_ } | Sort-Object Length -Descending)
    $weakTerms = @($cheatKeywords | Where-Object { $weakKeywords -contains $_ } | Sort-Object Length -Descending)
    $cheatPattern = '(?<s>' + (($strongTerms | ForEach-Object { [regex]::Escape($_) }) -join '|') + ')'
    if ($weakTerms.Count) { $cheatPattern += '|(?<=^|[^a-z0-9])(?<w>' + (($weakTerms | ForEach-Object { [regex]::Escape($_) }) -join '|') + ')(?=[^a-z0-9]|$)' }
    $cheatRegex = New-Object System.Text.RegularExpressions.Regex($cheatPattern, [System.Text.RegularExpressions.RegexOptions]'IgnoreCase, Compiled')
    $jarRegex = New-Object System.Text.RegularExpressions.Regex(('(^|/)(' + (($jarSignatures | ForEach-Object { [regex]::Escape($_) }) -join '|') + ')/'), [System.Text.RegularExpressions.RegexOptions]'IgnoreCase, Compiled')

    # Возвращает найденное название или $null. Папка профиля (C:\Users\<имя>) в расчёт не берётся:
    # имя пользователя Windows — не находка. Отличительное название важнее общего слова в том же тексте.
    function Get-CheatMatch([string]$text) {
        if ([string]::IsNullOrWhiteSpace($text)) { return $null }
        $clean = $text -replace '(?i)[\\/]Users[\\/][^\\/]+', '\Users\~'
        $weakHit = $null
        foreach ($m in $cheatRegex.Matches($clean)) {
            if ($m.Groups['s'].Success) { return $m.Value.ToLower() }
            if (-not $weakHit) { $weakHit = $m.Value.ToLower() }
        }
        return $weakHit
    }

    function Add-TraceHit([string]$source, [string]$name, [string]$path, [string]$detail, [string]$severity) {
        foreach ($term in $weakKeywords) {
            if ($name.EndsWith((': ' + $term), [StringComparison]::OrdinalIgnoreCase)) {
                $severity = 'WARNING'
                $detail += '; общее слово или обычная программа — возможно ложное совпадение'
                break
            }
        }
        if (-not $hitKeys.Add(($source + [char]0 + $name + [char]0 + $path))) { return }
        $hits.Add([pscustomobject]@{
            Source   = $source
            Name     = $name
            Path     = $path
            Detail   = $detail
            Severity = $severity
        })
    }

    function Convert-Rot13([string]$inputStr) {
        if ([string]::IsNullOrEmpty($inputStr)) { return "" }
        $chars = $inputStr.ToCharArray()
        for ($i = 0; $i -lt $chars.Length; $i++) {
            $c = [int]$chars[$i]
            if ($c -ge 65 -and $c -le 90) {
                $chars[$i] = [char](((($c - 65) + 13) % 26) + 65)
            } elseif ($c -ge 97 -and $c -le 122) {
                $chars[$i] = [char](((($c - 97) + 13) % 26) + 97)
            }
        }
        return -join $chars
    }

    function Get-SidAccount([string]$sid) {
        try { return (New-Object Security.Principal.SecurityIdentifier($sid)).Translate([Security.Principal.NTAccount]).Value } catch { return $sid }
    }

    function Audit-ServicesAndTampering {
        Write-Host "  [*] Аудит системных служб и попыток сокрытия..." -ForegroundColor DarkCyan
        $targetServices = @('PcaSvc', 'SysMain', 'DPS', 'EventLog')
        foreach ($sName in $targetServices) {
            $srv = Get-Service -Name $sName -ErrorAction SilentlyContinue
            if ($srv) {
                if ($srv.Status -ne 'Running' -or $srv.StartType -eq 'Disabled') {
                    Add-TraceHit "SERVICES" ("Служба остановлена или выключена: $sName") $srv.Name ("Статус: " + $srv.Status + ", запуск: " + $srv.StartType + "; остановка службы сама по себе не доказывает вмешательство") "WARNING"
                }
            } else {
                Add-TraceHit "SERVICES" ("Служба отсутствует: $sName") $sName "Служба не найдена или недоступна; возможны особенности конфигурации Windows" "WARNING"
            }
        }

        # Отсутствие событий отличается от отказа доступа к журналу.
        foreach ($logSpec in @(@{Log='Security'; Id=1102}, @{Log='System'; Id=104})) {
            $eventErrors = @()
            $events = @(Get-WinEvent -FilterHashtable @{LogName=$logSpec.Log; Id=$logSpec.Id} -MaxEvents 5 -ErrorAction SilentlyContinue -ErrorVariable eventErrors)
            foreach ($err in $eventErrors) {
                if ($err.FullyQualifiedErrorId -notlike 'NoMatchingEventsFound*') {
                    Add-ScanNote ("Журнал $($logSpec.Log): " + $err.Exception.Message)
                }
            }
            foreach ($evt in $events) {
                Add-TraceHit 'EVENT_LOG' 'Зафиксирована очистка журнала событий' ($logSpec.Log + ': EventID ' + $logSpec.Id) ("Дата: " + $evt.TimeCreated.ToString('dd.MM.yyyy HH:mm:ss') + '; возможна штатная очистка администратором') 'WARNING'
            }
        }
        # Ошибка fsutil сама по себе не доказывает очистку USN.
        if ($isAdmin) {
            $systemDrive = $env:SystemDrive
            if ($systemDrive) {
                $usnOutput = @(& fsutil.exe usn queryjournal $systemDrive 2>&1)
                if ($LASTEXITCODE -ne 0) {
                    Add-ScanNote ("USN $systemDrive не проверен (код $LASTEXITCODE): " + ($usnOutput -join ' '))
                }
            }
        } else { Add-ScanNote 'USN: проверка пропущена без прав администратора.' }

    }

    # Launchers pass the session token and account ids on the Java command line. The line itself is never shown or
    # saved: only the -javaagent path, the -noverify/-Xbootclasspath options and the matched name are. Before those
    # are cut out, the line is taken apart into arguments (quoted runs stay whole) and an option whose name has token,
    # password, passwd, secret, session, uuid, xuid, clientId, hwid, auth, jwt, cookie, apikey, accesskey,
    # userProperties or profileProperties in it loses its value, both as "--name value" (the next argument) and as
    # "name=value" / "name:value". Paths and other arguments are left as they are, so a word like "token" in a folder
    # name hides nothing.
    function Protect-CommandLine([string]$text) {
        if (-not $text) { return $text }
        $secretName = '(?i)(token|password|passwd|secret|session|uuid|xuid|client[-_]?id|hwid|auth|jwt|cookie|api[-_]?key|access[-_]?key|userproperties|profileproperties)'
        $out = New-Object System.Text.StringBuilder
        $maskNext = $false
        foreach ($m in [regex]::Matches($text, '(?:"[^"]*"|[^\s"])+|\s+')) {
            $arg = $m.Value
            if ($arg -match '^\s+$') { [void]$out.Append($arg); continue }
            $bare = $arg.Trim('"')
            # The value of a secret option is the next argument unless that is another option: a value never starts
            # with "-", and an option after it (-javaagent:...) must stay visible.
            if ($maskNext) { $maskNext = $false; if (-not $bare.StartsWith('-')) { [void]$out.Append('***'); continue } }
            if ($bare -match '^(-{1,2}[^=:\s]*)([=:])(.*)$') {
                $key = $Matches[1]; $sep = $Matches[2]; $value = $Matches[3]
                if ($key -match $secretName) {
                    [void]$out.Append($key + $sep + '***')
                    if (-not $value) { $maskNext = $true }
                    continue
                }
            } elseif ($bare -match '^-{1,2}[^=:\s]+$') {
                if ($bare -match $secretName) { $maskNext = $true }
            }
            [void]$out.Append($arg)
        }
        return $out.ToString()
    }

    function Audit-JavaProcessesAndInjections {
        Write-Host "  [*] Анализ запущенных процессов и инджектов в Java..." -ForegroundColor DarkCyan
        $allProcs = @(Get-CimInstance Win32_Process -ErrorAction Stop)
        # Любой процесс, а не только Java: автокликер или программа для очистки следов работают отдельно от игры.
        foreach ($proc in $allProcs) {
            $procPath = [string]$proc.ExecutablePath
            $term = Get-CheatMatch ([string]$proc.Name + ' ' + $procPath)
            if ($term) {
                $object = if ($procPath) { $procPath } else { [string]$proc.Name }
                Add-TraceHit "PROCESS" ("Совпадение в запущенном процессе: " + $term) $object ("PID " + $proc.ProcessId) "HIGH"
            }
        }
        foreach ($proc in @($allProcs | Where-Object { $_.Name -like 'java*.exe' })) {
            $cmd = [string]$proc.CommandLine
            if ($cmd) {
                $safeCmd = Protect-CommandLine $cmd
                $flags = @()
                foreach ($agent in [regex]::Matches($safeCmd, '-javaagent:(.+?\.jar)(?=[\s"=]|$)')) { $flags += ('-javaagent:' + $agent.Groups[1].Value) }
                foreach ($flag in [regex]::Matches($safeCmd, '(?:^|[\s"])(-noverify|-Xbootclasspath[^\s"]*)')) { $flags += $flag.Groups[1].Value }
                if ($flags.Count) {
                    Add-TraceHit "INJECTION" "Аргументы JVM требуют проверки" ("PID: " + $proc.ProcessId) ($flags -join '; ') "WARNING"
                }
                # Ник и идентификаторы игрока из строки не считаются: ник Raven_PvP — не находка.
                $term = Get-CheatMatch ($safeCmd -replace '(?i)--(username|uuid|xuid)\s+\S+', '')
                if ($term) {
                    Add-TraceHit "INJECTION" ("Совпадение в аргументах запуска: " + $term) ("PID: " + $proc.ProcessId) "Название найдено в строке запуска Java; сама строка не выводится" "HIGH"
                }
            }

            try {
                $p = Get-Process -Id $proc.ProcessId -ErrorAction Stop
                # Метод, а не свойство: исключение внутри свойства PowerShell превращает в пустое значение без ошибки.
                $modules = @($p.get_Modules())
            } catch {
                Add-ScanNote ("Модули Java PID $($proc.ProcessId) не прочитаны: " + $_.Exception.Message)
                continue
            }
            foreach ($mod in $modules) {
                $modPath = [string]$mod.FileName
                if (-not $modPath) { continue }
                if ($modPath -match "\\(AppData\\Local\\Temp|Downloads)\\" -and $modPath.EndsWith(".dll", [StringComparison]::OrdinalIgnoreCase)) {
                    Add-TraceHit "INJECTION" "DLL подгружена из Temp/Downloads" ("PID " + $proc.ProcessId) $modPath "WARNING"
                }
                $term = Get-CheatMatch $modPath
                if ($term) {
                    Add-TraceHit "INJECTION" ("Совпадение в имени DLL Java: " + $term) ("PID " + $proc.ProcessId) $modPath "HIGH"
                }
            }
        }
    }

    function Audit-RegistryTraces {
        Write-Host "  [*] Сверка реестра Windows (BAM, UserAssist, RunMRU, AppCompat, MuiCache)..." -ForegroundColor DarkCyan

        # BAM / DAM (запуск исполняемых файлов на уровне ядра). Без прав администратора ключ закрыт:
        # это не должно останавливать остальные разделы реестра.
        foreach ($base in @('HKLM:\SYSTEM\CurrentControlSet\Services\bam\State\UserSettings', 'HKLM:\SYSTEM\CurrentControlSet\Services\dam\State\UserSettings')) {
            if (-not (Test-Path -LiteralPath $base)) { continue }
            try { $users = @(Get-ChildItem -LiteralPath $base -ErrorAction Stop) } catch { Add-ScanNote 'BAM: раздел закрыт, нужны права администратора.'; continue }
            foreach ($userKey in $users) {
                $account = Get-SidAccount $userKey.PSChildName
                foreach ($exe in $userKey.GetValueNames()) {
                    $term = Get-CheatMatch $exe
                    if (-not $term) { continue }
                    $value = $userKey.GetValue($exe)
                    $when = ''
                    if ($value -is [byte[]] -and $value.Length -ge 8) { $when = '; запуск ' + [DateTime]::FromFileTime([BitConverter]::ToInt64($value, 0)).ToString('dd.MM.yyyy HH:mm') }
                    Add-TraceHit "BAM_REGISTRY" ("Запуск через ядро: " + $term) $exe ("След в BAM/DAM, учётная запись " + $account + $when) "HIGH"
                }
            }
        }

        # UserAssist (история запуска из Проводника, закодированная в ROT13)
        foreach ($g in @(Get-ChildItem -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\UserAssist' -ErrorAction SilentlyContinue)) {
            $countKey = $g.OpenSubKey('Count')
            if (-not $countKey) { continue }
            foreach ($name in $countKey.GetValueNames()) {
                $decoded = Convert-Rot13 $name
                $term = Get-CheatMatch $decoded
                if ($term) { Add-TraceHit "USERASSIST" ("Запуск из GUI: " + $term) $decoded "Декодировано из UserAssist (ROT13)" "HIGH" }
            }
        }

        # RunMRU (история ввода в окно Win + R)
        $runKey = Get-Item -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\RunMRU' -ErrorAction SilentlyContinue
        if ($runKey) {
            foreach ($name in $runKey.GetValueNames()) {
                if ($name -eq 'MRUList') { continue }
                $val = [string]$runKey.GetValue($name)
                $term = Get-CheatMatch $val
                if ($term) { Add-TraceHit "RUN_MRU" ("Команда Win+R: " + $term) $val "История окна Выполнить" "HIGH" }
            }
        }

        # Compatibility Assistant и MuiCache: имена значений — пути EXE, которые запускались у этого пользователя.
        $exeLists = @(
            @{ Source = 'APPCOMPAT'; Path = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Compatibility Assistant\Store' },
            @{ Source = 'MUICACHE'; Path = 'HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\MuiCache' }
        )
        foreach ($list in $exeLists) {
            $key = Get-Item -LiteralPath $list.Path -ErrorAction SilentlyContinue
            if (-not $key) { continue }
            foreach ($valueName in $key.GetValueNames()) {
                $exe = $valueName -replace '\.(FriendlyAppName|ApplicationCompany)$', ''
                $term = Get-CheatMatch $exe
                if ($term) { Add-TraceHit $list.Source ("Запускавшийся EXE: " + $term) $exe "Путь из истории запуска программ" "HIGH" }
            }
        }
    }

    function Audit-DefenderExclusions {
        Write-Host "  [*] Проверка Windows Defender: исключения и защита в реальном времени..." -ForegroundColor DarkCyan
        try {
            $prefs = Get-MpPreference -ErrorAction Stop
            if (-not $isAdmin) {
                # Без прав администратора Defender вместо списка отдаёт строку N/A; это не исключение.
                Add-ScanNote 'Defender: исключения видны только администратору.'
            } else {
                foreach ($excl in @($prefs.ExclusionPath) + @($prefs.ExclusionProcess) + @($prefs.ExclusionExtension)) {
                    if (-not $excl -or $excl -like 'N/A*') { continue }
                    $term = Get-CheatMatch $excl
                    if ($term) {
                        Add-TraceHit "DEFENDER" ("Исключение AV совпадает с читом: " + $term) $excl "Путь исключён из проверки Defender" "HIGH"
                    } else {
                        Add-TraceHit "DEFENDER" "Обнаружено исключение антивируса" $excl "Требует ручной проверки: не связано с известной сигнатурой" "WARNING"
                    }
                }
            }
            $status = Get-MpComputerStatus -ErrorAction SilentlyContinue
            if ($status -and $status.AMRunningMode -and $status.AMRunningMode -ne 'Normal') {
                Add-ScanNote ('Defender в режиме ' + $status.AMRunningMode + ': компьютер защищает другой антивирус.')
            } elseif ($status -and -not $status.RealTimeProtectionEnabled) {
                Add-TraceHit "DEFENDER" "Защита в реальном времени выключена" 'Microsoft Defender' "Выясните, кто и когда её выключил" "WARNING"
            }
        } catch {
            Add-ScanNote ('Defender: ' + $_.Exception.Message)
        }
    }

    function Audit-ScheduledTasks {
        Write-Host "  [*] Автозапуск: планировщик, разделы Run и папки автозагрузки..." -ForegroundColor DarkCyan
        try {
            foreach ($task in @(Get-ScheduledTask -ErrorAction Stop)) {
                $taskName = [string]$task.TaskName
                foreach ($action in @($task.Actions)) {
                    $exec = [string]$action.Execute
                    $actionArgs = [string]$action.Arguments
                    $term = Get-CheatMatch "$taskName $exec $actionArgs"
                    if ($term) { Add-TraceHit "SCHEDULED_TASK" ("Совпадение в автозадаче: " + $term) ($task.TaskPath + $taskName) ("Команда: $exec $actionArgs") "HIGH" }
                }
            }
        } catch {
            Add-ScanNote ('Планировщик: ' + $_.Exception.Message)
        }
        foreach ($runPath in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run')) {
            $key = Get-Item -LiteralPath $runPath -ErrorAction SilentlyContinue
            if (-not $key) { continue }
            foreach ($name in $key.GetValueNames()) {
                $value = [string]$key.GetValue($name)
                $term = Get-CheatMatch ($name + ' ' + $value)
                if ($term) { Add-TraceHit "AUTORUN" ("Совпадение в разделе Run: " + $term) $value ("Значение " + $name + " в " + $runPath) "HIGH" }
            }
        }
        foreach ($dir in @([Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('CommonStartup'))) {
            if (-not $dir) { continue }
            foreach ($file in @(Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue)) {
                $term = Get-CheatMatch $file.Name
                if ($term) { Add-TraceHit "AUTORUN" ("Совпадение в автозагрузке: " + $term) $file.FullName "Ярлык или файл в папке автозагрузки" "HIGH" }
            }
        }
    }

    function Audit-RecycleBin {
        Write-Host "  [*] Сканирование Корзины (следы недавнего удаления улик)..." -ForegroundColor DarkCyan
        $shell = $null; $recycleBin = $null
        try {
            $shell = New-Object -ComObject Shell.Application
            $recycleBin = $shell.NameSpace(10)
            if ($recycleBin) {
                foreach ($item in $recycleBin.Items()) {
                    $itemName = [string]$item.Name
                    $term = Get-CheatMatch $itemName
                    if ($term) {
                        $delDate = try { $recycleBin.GetDetailsOf($item, 2) -replace '[\u200e\u200f]', '' } catch { "неизвестно" }
                        Add-TraceHit "RECYCLE_BIN" ("Совпадение в имени удалённого файла: " + $term) $itemName ("Дата удаления: " + $delDate) "HIGH"
                    }
                }
            }
        } catch {
            Add-ScanNote ('Корзина: ' + $_.Exception.Message)
        } finally {
            if ($recycleBin) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($recycleBin) }
            if ($shell) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell) }
        }
    }

    function Audit-HostsFile {
        Write-Host "  [*] Проверка файла hosts (перенаправленные адреса)..." -ForegroundColor DarkCyan
        $acDomainMarkers = @('anticheat', 'grim', 'vulcan', 'polar', 'negativity', 'spartan', 'intave', 'matrix', 'verus', 'aac')
        $markerRegex = '(?i)(?<![a-z0-9])(' + ($acDomainMarkers -join '|') + ')(?![a-z0-9])'
        $hostsPath = Join-Path $env:WINDIR "System32\drivers\etc\hosts"
        foreach ($line in @(Get-Content -LiteralPath $hostsPath -ErrorAction SilentlyContinue)) {
            $trimmed = $line.Trim()
            if (-not $trimmed -or $trimmed.StartsWith('#') -or $trimmed -match '\slocalhost$') { continue }
            # Каждая действующая строка показывается; слово античита в домене делает её заметнее.
            if ($trimmed -match $markerRegex) {
                Add-TraceHit "HOSTS_TAMPERING" ("Маркер в перенаправленном домене: " + $Matches[1].ToLower()) $trimmed "Совпадение слова в hosts; принадлежность домена античиту не установлена" "WARNING"
            } else {
                Add-TraceHit "HOSTS" "Перенаправленный адрес" $trimmed "Проверьте, чей это домен" "WARNING"
            }
        }
    }

    function Audit-PrefetchDirectory {
        Write-Host "  [*] Сканирование кэша Prefetch..." -ForegroundColor DarkCyan
        $prefetchMode = (Get-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters' -ErrorAction SilentlyContinue).EnablePrefetcher
        if ($prefetchMode -eq 0) { Add-TraceHit "PREFETCH" "Prefetch выключен" "EnablePrefetcher = 0" "Запись Prefetch выключена в реестре" "WARNING" }
        $pfFolder = Join-Path $env:WINDIR "Prefetch"
        try { $files = @(Get-ChildItem -LiteralPath $pfFolder -Filter "*.pf" -ErrorAction Stop) } catch { Add-ScanNote 'Prefetch: папка закрыта, нужны права администратора.'; return }
        if ($files.Count -lt 30) {
            Add-TraceHit "PREFETCH" "Prefetch почти пуст" $pfFolder ("Файлов: " + $files.Count + "; Prefetch могли очистить, проверьте время самого старого файла") "WARNING"
        }
        foreach ($file in $files) {
            $term = Get-CheatMatch $file.Name
            if ($term) { Add-TraceHit "PREFETCH" ("Файл запуска: " + $term) $file.FullName ("Время изменения: " + $file.LastWriteTime.ToString('dd.MM.yyyy HH:mm:ss')) "HIGH" }
        }
    }

    function Audit-JarFile([IO.FileInfo]$jar) {
        if ($jar.Length -gt 268435456) {
            Add-ScanNote ('JAR больше 256 МБ пропущен: ' + $jar.FullName)
            return
        }
        # Файл только в облаке OneDrive: открытие скачало бы его из сети.
        if ($jar.Attributes -band 0x441000) {
            Add-ScanNote ('JAR лежит только в облаке и не скачивался: ' + $jar.FullName)
            return
        }
        $zip = $null
        try {
            $zip = [IO.Compression.ZipFile]::OpenRead($jar.FullName)
            $stats.JarsChecked++
            $found = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
            $entryCount = 0
            foreach ($entry in $zip.Entries) {
                $entryCount++
                if ($entryCount -gt 100000) {
                    Add-ScanNote ('Лимит 100000 записей внутри JAR: ' + $jar.FullName)
                    break
                }
                if (-not $entry.FullName.EndsWith('.class', [StringComparison]::OrdinalIgnoreCase)) { continue }
                $m = $jarRegex.Match($entry.FullName)
                if ($m.Success -and $found.Add($m.Groups[2].Value)) {
                    Add-TraceHit 'DEEP_JAR' ('Совпадение пакета: ' + $m.Groups[2].Value.ToLower()) $jar.FullName ('Запись: ' + $entry.FullName + '; проверяются имена пакетов, не поведение программы') 'HIGH'
                }
            }
        } catch {
            $stats.AccessErrors++
            Add-ScanNote ('JAR не прочитан: ' + $jar.FullName + ' — ' + $_.Exception.Message)
        } finally { if ($zip) { $zip.Dispose() } }
    }

    function Test-ShouldSkipPath([string]$path) {
        # Проверяется ДО входа в каталог; символы пути трактуются буквально.
        return $path -match '(?i)(^|[\\/])(node_modules|\.git|\$Recycle\.Bin|System Volume Information)([\\/]|$)|[\\/]Windows[\\/](WinSxS|servicing|assembly|System32[\\/]DriverStore)([\\/]|$)|[\\/]Program Files[\\/]WindowsApps([\\/]|$)|[\\/]ProgramData[\\/]Package Cache([\\/]|$)'
    }

    function Audit-FileSystemPaths {
        param([string[]]$Paths, [switch]$DeepJar)
        $pending = New-Object 'System.Collections.Generic.Stack[string]'
        foreach ($path in $Paths) {
            if ($path -and (Test-Path -LiteralPath $path -PathType Container)) { $pending.Push($path) }
        }
        try {
            while ($pending.Count -gt 0) {
                $folder = $pending.Pop()
                if (Test-ShouldSkipPath $folder) { continue }
                $folderErrors = @()
                $root = Get-Item -LiteralPath $folder -Force -ErrorAction SilentlyContinue -ErrorVariable folderErrors
                if ($folderErrors.Count -gt 0 -or -not $root) { $stats.AccessErrors++; continue }
                if ($root.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
                if (-not $visited.Add($root.FullName.TrimEnd('\'))) { continue }
                $stats.DirectoriesChecked++
                if ($stats.DirectoriesChecked % 25 -eq 1) {
                    Write-Progress -Id 1 -Activity 'TRACE-PRO: проверка' -Status ("Файлов: $($stats.FilesChecked) | JAR: $($stats.JarsChecked) | Находок: $($hits.Count) | $folder")
                }
                $childErrors = @()
                foreach ($item in @(Get-ChildItem -LiteralPath $folder -Force -ErrorAction SilentlyContinue -ErrorVariable childErrors)) {
                    # Имя проверяется у всего, в том числе у ссылок и точек соединения; внутрь ссылок обход не заходит.
                    # Имя, а не полный путь: имя родительской папки не порождает тысячи дублей.
                    $term = Get-CheatMatch $item.Name
                    if ($term) {
                        $sev = if ($item.Extension -in @('.jar','.exe','.dll','.bat','.cmd')) { 'HIGH' } else { 'WARNING' }
                        Add-TraceHit 'FILE' ('Совпадение в имени: ' + $term) $item.FullName ('Изменён: ' + $item.LastWriteTime.ToString('dd.MM.yyyy HH:mm:ss')) $sev
                    }
                    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or (Test-ShouldSkipPath $item.FullName)) { continue }
                    if ($item.PSIsContainer) { $pending.Push($item.FullName) } else { $stats.FilesChecked++ }
                    if ($DeepJar -and -not $item.PSIsContainer -and $item.Extension -ieq '.jar') { Audit-JarFile $item }
                }
                $stats.AccessErrors += $childErrors.Count
            }
        } finally {
            Write-Progress -Id 1 -Activity 'TRACE-PRO: проверка' -Completed
            if ($stats.AccessErrors -gt 0) { Add-ScanNote 'Часть файлов или каталогов недоступна. Итог относится только к прочитанным данным.' }
        }
    }

    $severityRank = @{ 'CRITICAL' = 0; 'HIGH' = 1; 'WARNING' = 2 }

    function Show-TraceResults([string]$scope, [TimeSpan]$elapsed) {
        Write-Host ""
        Write-Host " ═════════════════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
        Write-Host "  РЕЗУЛЬТАТЫ СКАНИРОВАНИЯ // ОБЛАСТЬ: $scope" -ForegroundColor White
        Write-Host " ═════════════════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray

        # Дедупликация по фактическому содержимому находки (Source+Name+Path), а не по объекту целиком
        $dedupedHits = @(
            $hits | Group-Object -Property @('Source', 'Name', 'Path') | ForEach-Object { $_.Group[0] }
        )
        $sortedHits = @($dedupedHits | Sort-Object -Property @(@{ Expression = { $severityRank[$_.Severity] } }, 'Source'))

        if ($sortedHits.Count -eq 0) {
            Write-Host "  [+] Совпадений в проверенных источниках не найдено. Это не гарантирует отсутствие читов." -ForegroundColor Green
        } else {
            $critCount = @($sortedHits | Where-Object { $_.Severity -eq 'CRITICAL' }).Count
            $highCount = @($sortedHits | Where-Object { $_.Severity -eq 'HIGH' }).Count
            $warnCount = @($sortedHits | Where-Object { $_.Severity -eq 'WARNING' }).Count

            Write-Host ("  [!] Зафиксировано находок: " + $sortedHits.Count + `
                "  (CRITICAL: $critCount | HIGH: $highCount | WARNING: $warnCount)") -ForegroundColor Yellow
            Write-Host ""

            foreach ($hit in $sortedHits) {
                $color = switch ($hit.Severity) {
                    'CRITICAL' { 'Red' }
                    'HIGH'     { 'Magenta' }
                    'WARNING'  { 'Yellow' }
                    default    { 'Cyan' }
                }
                Write-Host ("  [$($hit.Severity)] [$($hit.Source)] $($hit.Name)") -ForegroundColor $color
                Write-Host ("      Объект : $($hit.Path)") -ForegroundColor White
                Write-Host ("      Детали : $($hit.Detail)") -ForegroundColor DarkGray
                Write-Host ""
            }
        }

        Write-Host " ─────────────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
        $elapsedStr = "{0}м {1:00}с" -f [int][Math]::Floor($elapsed.TotalMinutes), $elapsed.Seconds
        Write-Host ("  Проверено файлов: $($stats.FilesChecked) | Находок: $($sortedHits.Count) | Время сканирования: $elapsedStr") -ForegroundColor DarkGray
        Write-Host "  Совпадение не доказывает использование чита. Проверяйте путь, содержимое и время." -ForegroundColor DarkYellow
        Write-Host ("  JAR проверено: $($stats.JarsChecked) | Ошибок доступа: $($stats.AccessErrors)") -ForegroundColor DarkGray
        foreach ($note in $scanNotes) { Write-Host ("  [Неполная проверка] " + $note) -ForegroundColor Yellow }
        $reportState.LastReport = [pscustomobject]@{
            Version = '9.0'; Timestamp = (Get-Date).ToString('o'); Scope = $scope
            DurationSeconds = [Math]::Round($elapsed.TotalSeconds, 2)
            Statistics = $stats.Clone(); Notes = @($scanNotes.ToArray()); Findings = @($sortedHits)
        }
        Write-Host " ─────────────────────────────────────────────────────────────────────────────`n" -ForegroundColor DarkGray
    }

    function Export-TraceReport {
        if (-not $reportState.LastReport) {
            Write-Host '  Сначала выполните сканирование.' -ForegroundColor Yellow
            return
        }
        $reportFolder = ([string](Read-Host '  Папка для отчёта (Enter — Документы\TRACE-PRO)')).Trim().Trim('"')
        if (-not $reportFolder) {
            $documents = [Environment]::GetFolderPath('MyDocuments')
            if (-not $documents) { $documents = $env:USERPROFILE }
            $reportFolder = Join-Path $documents 'TRACE-PRO'
        }
        try {
            [void][IO.Directory]::CreateDirectory($reportFolder)
            $base = Join-Path $reportFolder ('trace_' + (Get-Date -Format 'yyyyMMdd_HHmmss_fff'))
            $reportState.LastReport | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath ($base + '.json') -Encoding UTF8 -ErrorAction Stop
            Write-Host ('  JSON: ' + $base + '.json') -ForegroundColor Green
            if ($reportState.LastReport.Findings.Count -gt 0) {
                # Neutralize spreadsheet formula prefixes without changing the JSON evidence.
                $reportState.LastReport.Findings | ForEach-Object {
                    $row = [ordered]@{}
                    foreach ($field in @('Source','Name','Path','Detail','Severity')) {
                        $value = [string]$_.PSObject.Properties[$field].Value
                        if ($value -match '^\s*[=+@-]') { $value = "'" + $value }
                        $row[$field] = $value
                    }
                    [pscustomobject]$row
                } | Export-Csv -LiteralPath ($base + '.csv') -NoTypeInformation -Encoding UTF8 -ErrorAction Stop
                Write-Host ('  CSV: ' + $base + '.csv') -ForegroundColor Green
            }
        } catch { Write-Host ('  Не удалось сохранить отчёт: ' + $_.Exception.Message) -ForegroundColor Red }
    }

    # A preset runs one scan of the chosen depth, then hands over to the menu
    # so the report can still be saved (5) or the session closed (0).
    $presetChoices = @{ 'quick' = 'Q'; 'system' = '1'; 'minecraft' = '2'; 'full' = '3' }
    $autoChoice = if ($Preset) { $presetChoices[[string]$Preset] } else { $null }
    while ($true) {
        if ($autoChoice) {
            $choice = $autoChoice; $autoChoice = $null
            Write-Host ('  [*] Глубина проверки: ' + ([string]$Preset).ToUpper() + ' — запуск без меню.') -ForegroundColor DarkCyan
        } else {
            Write-Host '  ┌──────────── TRACE-PRO / РЕЖИМ ПРОВЕРКИ ────────────┐' -ForegroundColor DarkGray
            Write-Host '  │ 1  Экспресс-аудит системы                          │'
            Write-Host '  │ 2  Minecraft: система, файлы и содержимое JAR      │'
            Write-Host '  │ 3  Все диски: система, файлы и JAR                 │'
            Write-Host '  │ 4  Только выбранная папка: файлы и JAR             │'
            Write-Host '  │ 5  Сохранить последний отчёт (JSON / CSV)          │'
            Write-Host '  │ 0  Выход                                           │'
            Write-Host '  └────────────────────────────────────────────────────┘' -ForegroundColor DarkGray
            $choice = ([string](Read-Host '  TRACE-PRO > [0-5]')).Trim()
        }
        if ($choice -eq '0' -or ($choice -eq '' -and [Console]::IsInputRedirected)) { break }
        if ($choice -eq '5') { Export-TraceReport; continue }
        if ($choice -notin @('Q','1','2','3','4')) { Write-Host '  Введите цифру от 0 до 5.' -ForegroundColor Yellow; continue }
        $customPath = $null
        if ($choice -eq '4') {
            $customPath = ([string](Read-Host '  Полный путь к папке')).Trim().Trim('"')
            if (-not $customPath -or -not (Test-Path -LiteralPath $customPath -PathType Container)) {
                Write-Host '  Папка не найдена или недоступна.' -ForegroundColor Yellow
                continue
            }
        }
        $hits.Clear(); $hitKeys.Clear(); $scanNotes.Clear(); $visited.Clear()
        foreach ($key in @($stats.Keys)) { $stats[$key] = 0 }
        $clock = [Diagnostics.Stopwatch]::StartNew()
        if ($choice -ne '4') {
            if (-not $isAdmin) { Add-ScanNote 'Без прав администратора часть системных источников недоступна.' }
            $audits = if ($choice -eq 'Q') { @('Audit-JavaProcessesAndInjections','Audit-PrefetchDirectory') } else { @('Audit-ServicesAndTampering','Audit-JavaProcessesAndInjections','Audit-RegistryTraces','Audit-PrefetchDirectory','Audit-DefenderExclusions','Audit-ScheduledTasks','Audit-RecycleBin','Audit-HostsFile') }
            foreach ($audit in $audits) {
                Invoke-TraceAudit $audit
            }
        }
        # Ctrl+C во время обхода всё равно показывает то, что уже найдено.
        $completed = $false
        try {
            switch ($choice) {
                '2' { Audit-FileSystemPaths -Paths $gameRoots -DeepJar }
                '3' {
                    Write-Host '  Полный обход может занять время. Остановка: Ctrl+C, найденное до остановки будет показано.' -ForegroundColor Yellow
                    # Встроенные диски и флешки.
                    $drives = @([IO.DriveInfo]::GetDrives() | Where-Object { $_.IsReady -and ($_.DriveType -eq 'Fixed' -or $_.DriveType -eq 'Removable') } | ForEach-Object { $_.RootDirectory.FullName })
                    Audit-FileSystemPaths -Paths $drives -DeepJar
                }
                '4' { Audit-FileSystemPaths -Paths @($customPath) -DeepJar }
            }
            $completed = $true
        } catch { Add-ScanNote ('Сканирование прервано ошибкой: ' + $_.Exception.Message) } finally {
            $clock.Stop()
            if (-not $completed) { Add-ScanNote 'Проверка остановлена до конца: показано только то, что найдено к этому моменту.' }
            $scopeNames = @{'Q'='БЫСТРАЯ ПРОВЕРКА'; '1'='ЭКСПРЕСС-АУДИТ'; '2'='MINECRAFT'; '3'='ВСЕ ДИСКИ'; '4'=$customPath}
            Show-TraceResults $scopeNames[$choice] $clock.Elapsed
        }
        if ($choice -eq 'Q') { Write-Host '  Быстрая проверка не читает реестр, журналы и файлы. Для большей глубины выберите 1–3 в меню.' -ForegroundColor DarkYellow }
    }

}
