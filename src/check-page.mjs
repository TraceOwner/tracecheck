import {toolIcon} from './tool-icons.mjs';
import {arrow,arrowDown,asterisk,chevron,close,copy} from './icons.mjs';

const tab = (tool,num,label,selected) => `<button class="tool-tab" id="tab-${tool}" type="button" role="tab" aria-selected="${selected}" aria-controls="tool-panel"${selected?'':' tabindex="-1"'} data-tool="${tool}"><span class="tool-mini ${tool}-mini" aria-hidden="true">${toolIcon(tool)}</span><strong>${label}</strong></button>`;
const check = (value,label) => `<label><input type="checkbox" value="${value}" autocomplete="off"><span class="check-box" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="m4 8.4 2.6 2.6L12 5.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="check-text">${label}</span></label>`;

export const checkPage = `
<section class="page-intro container check-intro">
  <p class="eyebrow">Локальная проверка</p>
  <div class="intro-row"><h1>Проверка<span class="accent-dot">.</span></h1><p>Выберите игру, прочитайте команду и запустите её на своём ПК. Результат остаётся у вас.</p></div>
</section>
<noscript><section class="container check-noscript"><h2>Без JavaScript команда не собирается.</h2><p>Эта страница собирает команду из выбранной игры и способа прямо в браузере. Без JavaScript можно скачать готовые скрипты, открыть их в Блокноте, прочитать и только потом запустить:</p><ul><li><a class="text-link" href="scripts/trace-pro-minecraft.ps1" download>trace-pro-minecraft.ps1</a> — сценарий TRACE-PRO для Minecraft, с меню режимов.</li><li><a class="text-link" href="scripts/trace-check.ps1" download>trace-check.ps1</a> — общий отчёт: список процессов и, по желанию, контрольные суммы файлов в одной папке.</li><li><a class="text-link" href="scripts/trace-check.cmd" download>trace-check.cmd</a> — список процессов через tasklist.</li></ul><p>Что именно читает каждый скрипт, описано в <a class="text-link" href="legal.html?doc=rules">правилах использования</a>.</p></section></noscript>
<section class="check-game-stage container" aria-labelledby="game-stage-title">
  <div class="check-game-copy"><span class="mini-label">Шаг 1</span><h2 id="game-stage-title">Выберите игру.</h2></div>
  <div class="game-picker"><label id="game-label">Игра</label><div class="game-select"><button class="game-select-trigger" id="game-trigger" type="button" role="combobox" aria-labelledby="game-label game-value" aria-haspopup="listbox" aria-expanded="false" aria-controls="game-options"><span class="game-value-window"><span class="game-value" id="game-value">Minecraft</span></span><span class="game-chevron">${chevron}</span></button><div class="game-options" id="game-options" role="listbox" aria-labelledby="game-label" hidden></div></div><select id="game" class="game-native-select" aria-hidden="true" tabindex="-1"><option value="minecraft">Minecraft</option><option value="gta">GTA V RP</option><option value="cs2">Counter-Strike 2</option></select><p id="game-note"></p></div>
</section>
<section class="check-layout container" aria-labelledby="method-title">
  <aside class="check-rail">
    <p class="mini-label">Шаг 2</p><h2 id="method-title">Способ проверки</h2>
    <div class="tool-tabs" role="tablist" aria-label="Способ проверки"><span class="tab-lens" aria-hidden="true"></span>${tab('powershell','01','PowerShell',true)}${tab('cmd','02','CMD',false)}${tab('manual','03','Вручную',false)}</div>
    <p class="rail-help">Trace показывает команды, но не запускает их и не получает данные с вашего устройства.</p>
    <a class="rail-tool-link" href="tools.html">Программы для ручной проверки ${arrow}</a>
  </aside>
  <div class="check-main" id="tool-panel" role="tabpanel" aria-labelledby="tab-powershell" tabindex="0">
    <div class="tool-head"><span class="mini-label" id="tool-kicker">Шаг 3 · Полная проверка</span><span class="platform-badge">Windows 10 и 11</span></div>
    <h2 id="tool-title">PowerShell</h2><p class="tool-description" id="tool-description"></p>
    <section class="depth-panel" id="depth-panel" aria-labelledby="depth-label" hidden>
      <div class="depth-head"><span class="mini-label" id="depth-label">Глубина проверки / Minecraft</span><button class="depth-menu" id="depth-menu" type="button" aria-pressed="false"><span class="depth-menu-dot" aria-hidden="true"></span>Меню в терминале</button></div>
      <div class="depth-track" id="depth-track" role="slider" tabindex="0" aria-labelledby="depth-label" aria-valuemin="1" aria-valuemax="4" aria-valuenow="3" aria-valuetext="Minecraft">
        <span class="depth-rail" aria-hidden="true"><span class="depth-fill"></span></span>
        <span class="depth-stops" aria-hidden="true"><span class="depth-stop" data-level="0"><i></i><b>Быстрый</b></span><span class="depth-stop" data-level="1"><i></i><b>Системный</b></span><span class="depth-stop" data-level="2"><i></i><b>Minecraft</b></span><span class="depth-stop" data-level="3"><i></i><b>Полный</b></span></span>
        <span class="depth-thumb" aria-hidden="true"><span class="depth-thumb-core"></span></span>
      </div>
      <div class="depth-meta"><div class="depth-meta-title"><strong id="depth-title">Minecraft</strong><span class="depth-time" id="depth-time">несколько минут</span></div><p id="depth-summary"></p></div>
      <ul class="depth-sources" id="depth-sources" aria-label="Что проверяется"></ul>
    </section>
    <div id="command-content">
      <div class="terminal" id="terminal"><div class="terminal-heading"><span class="terminal-indicator" aria-hidden="true"></span><span id="terminal-title">Windows PowerShell</span><span class="terminal-scope">Локально, без отправки</span></div><div class="terminal-body"><span id="prompt">PS &gt;</span><code id="command"></code></div><div class="terminal-actions"><span id="command-scope">Команда только читает выбранные данные</span><button id="copy" class="copy-button" type="button"><span class="copy-icon">${copy}</span><span class="copy-label-window"><span class="copy-label">Скопировать команду</span></span></button></div></div>
      <p class="command-result" id="command-result"></p>
      <div class="action-row"><button class="button button-light" id="instructions" type="button"><span class="button-label"><span data-label="Как запустить">Как запустить</span></span></button><a class="button button-soft" id="download" href="scripts/trace-check.ps1" download><span class="download-label button-label"><span data-label="Скачать общий отчёт .ps1">Скачать общий отчёт .ps1</span></span><span class="arrow" aria-hidden="true">${arrowDown}</span></a></div>
      <p class="download-context" id="download-context">Скачиваемый скрипт собирает общий список; команда выше ищет названия, характерные для выбранной игры.</p>
    </div>
    <div id="manual-content" hidden><div class="manual-help"><b>Проверка без команд</b><p id="manual-guide"></p></div><div class="manual-list">${check('processes','Проверены процессы и расположение неизвестных файлов')}${check('game','Сверены файлы игры и разрешённые модификации')}${check('context','Учтены правила сервера и объяснения игрока')}</div><button class="button button-light" id="export-checklist" type="button"><span class="button-label"><span data-label="Сохранить чек-лист">Сохранить чек-лист</span></span> <span class="arrow" aria-hidden="true">${arrowDown}</span></button></div>
    <section class="signal-panel" aria-labelledby="signal-title"><div class="signal-head"><span class="mini-label">Названия / <span id="signal-game">MINECRAFT</span></span><span class="signal-cross" aria-hidden="true">${asterisk}</span></div><h3 id="signal-title">Имена, по которым идёт поиск</h3><div class="signal-names" id="signal-names"></div><p id="signal-context"></p><div class="signal-links" id="signal-links"></div></section>
    <p class="check-note"><span class="check-note-mark" aria-hidden="true">${asterisk}</span><span>Команда ищет только известные названия. Совпадение говорит, что стоит разобраться, а не что игрок виновен. Пустой результат не доказывает, что читов на ПК нет.</span></p>
  </div>
  <aside class="check-aside"><span class="mini-label">Кто запускает</span><h2>Три ситуации</h2><ul class="scope-list"><li><div><strong>Самостоятельно</strong><p>Команды запускает владелец устройства. Перед передачей отчёта проверьте личные пути и имена.</p></div></li><li><div><strong>Удалённая проверка</strong><p>Следуйте правилам сервера. <a href="https://reallyworld.ru/anydesk" target="_blank" rel="noopener noreferrer">ReallyWorld</a> прямо запрещает проверяющему открывать CMD или PowerShell через AnyDesk.</p></div></li><li><div><strong>По просьбе проверяющего</strong><p>Сначала прочитайте команду и правила проекта. Trace показывает совпадения и не выносит вердикт; решение принимает проверяющий.</p></div></li></ul><a class="text-link aside-link" href="methodology.html">Как читать результат ${arrow}</a></aside>
</section>
<section class="check-bottom container" data-reveal><div><span class="eyebrow">После проверки</span><h2>Если нашлось совпадение,<br>разбирайтесь вручную.</h2></div><a class="text-link" href="tools.html">Программы для разбора находок ${arrow}</a></section>
<dialog class="trace-panel" id="guide" aria-labelledby="guide-title"><div class="panel-head"><span class="mini-label">Инструкция</span><button type="button" data-close-dialog class="icon-button" aria-label="Закрыть инструкцию">${close}</button></div><h2 id="guide-title">Как запустить проверку</h2><div id="guide-body"></div><div class="panel-foot"><button type="button" class="button button-light" data-close-dialog><span class="button-label"><span data-label="Закрыть">Закрыть</span></span></button></div></dialog>`;
