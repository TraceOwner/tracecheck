import {toolIcon} from './tool-icons.mjs';
import {arrow,arrowDown,chevron,close,copy} from './icons.mjs';

const tab = (tool,label,selected) => `<button class="tool-tab" id="tab-${tool}" type="button" role="tab" aria-selected="${selected}" aria-controls="tool-panel"${selected?'':' tabindex="-1"'} data-tool="${tool}"><span class="tool-mini ${tool}-mini" aria-hidden="true">${toolIcon(tool)}</span><strong>${label}</strong></button>`;
const check = (value,label) => `<label><input type="checkbox" value="${value}" autocomplete="off"><span class="check-box" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="m4 8.4 2.6 2.6L12 5.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="check-text">${label}</span></label>`;

export const checkPage = `
<section class="page-intro container check-intro">
  <p class="eyebrow">Локальная проверка</p>
  <div class="intro-row"><h1>Проверка<span class="accent-dot">.</span></h1><p>Выберите игру и что проверить, прочитайте команду и запустите её на своём ПК. Результат остаётся у вас.</p></div>
</section>
<noscript><section class="container check-noscript"><h2>Без JavaScript команда не собирается.</h2><p>Можно скачать полную проверку для своей игры, открыть файл в Блокноте, прочитать и только потом запустить:</p><ul><li><a class="text-link" href="scripts/trace-pro-minecraft.ps1" download>trace-pro-minecraft.ps1</a> — Minecraft, сценарий TRACE-PRO с меню режимов.</li><li><a class="text-link" href="scripts/trace-gta.ps1" download>trace-gta.ps1</a> — GTA V RP.</li><li><a class="text-link" href="scripts/trace-cs2.ps1" download>trace-cs2.ps1</a> — Counter-Strike 2.</li><li><a class="text-link" href="scripts/trace-check.ps1" download>trace-check.ps1</a> — общий отчёт: список процессов и, по желанию, контрольные суммы файлов в одной папке.</li></ul><p>Что именно читает каждый файл, описано в <a class="text-link" href="legal.html?doc=rules">правилах использования</a>.</p></section></noscript>
<section class="check-layout container" aria-label="Команда для проверки">
  <div class="check-rail">
    <div class="game-picker"><label id="game-label" class="rail-label">Игра</label><div class="game-select"><button class="game-select-trigger" id="game-trigger" type="button" role="combobox" aria-labelledby="game-label game-value" aria-haspopup="listbox" aria-expanded="false" aria-controls="game-options"><span class="game-value-window"><span class="game-value" id="game-value">Minecraft</span></span><span class="game-chevron">${chevron}</span></button><div class="game-options" id="game-options" role="listbox" aria-labelledby="game-label" hidden></div></div><select id="game" class="game-native-select" aria-hidden="true" tabindex="-1" autocomplete="off"><option value="minecraft">Minecraft</option><option value="gta">GTA V RP</option><option value="cs2">Counter-Strike 2</option></select></div>
    <p class="rail-label" id="method-label">Способ</p>
    <div class="tool-tabs" role="tablist" aria-labelledby="method-label"><span class="tab-lens" aria-hidden="true"></span>${tab('powershell','PowerShell',true)}${tab('cmd','CMD',false)}${tab('manual','Вручную',false)}</div>
    <a class="rail-tool-link" href="tools.html">Программы для проверки ${arrow}</a>
  </div>
  <div class="check-main" id="tool-panel" role="tabpanel" aria-labelledby="tab-powershell"><h2 class="visually-hidden">Команда</h2>
    <div id="command-content">
      <fieldset class="task-picker"><legend class="rail-label">Что проверить</legend><div class="task-grid" id="task-grid"></div></fieldset>
      <p class="task-about" id="task-about"></p>
      <div class="terminal" id="terminal"><div class="terminal-heading"><span class="terminal-indicator" aria-hidden="true"></span><span id="terminal-title">Windows PowerShell</span></div><div class="terminal-body" tabindex="0" role="region" aria-label="Текст команды"><span id="prompt">PS &gt;</span><code id="command"></code></div><div class="terminal-actions"><span id="command-scope"></span><button id="copy" class="copy-button" type="button"><span class="copy-icon">${copy}</span><span class="copy-label-window"><span class="copy-label">Скопировать команду</span></span></button></div></div>
      <p class="task-hint" id="task-hint" hidden></p>
      <div class="action-row"><button class="button button-light" id="instructions" type="button"><span class="button-label"><span data-label="Как запустить">Как запустить</span></span></button><a class="button button-soft" id="download" href="scripts/trace-pro-minecraft.ps1" download><span class="download-label button-label"><span data-label="Скачать полную проверку .ps1">Скачать полную проверку .ps1</span></span><span class="arrow" aria-hidden="true">${arrowDown}</span></a></div>
      <details class="names-panel"><summary><span>Какие названия ищет команда</span><span class="names-count" id="names-count"></span><span class="names-chevron" aria-hidden="true">${chevron}</span></summary><div class="names-body"><p id="names-source"></p><ul class="names-list" id="names-list"></ul><p class="names-jar" id="names-jar" hidden></p></div></details>
    </div>
    <div id="manual-content" hidden><div class="manual-help"><b>Проверка без команд</b><p id="manual-guide"></p></div><div class="manual-list">${check('processes','Проверены процессы и расположение неизвестных файлов')}${check('game','Сверены файлы игры и разрешённые модификации')}${check('context','Учтены правила сервера и объяснения игрока')}</div><button class="button button-light" id="export-checklist" type="button"><span class="button-label"><span data-label="Сохранить чек-лист">Сохранить чек-лист</span></span> <span class="arrow" aria-hidden="true">${arrowDown}</span></button></div>
    <p class="check-note">Совпадение названия — повод разобраться, а не доказательство. Пустой результат не доказывает, что ПК чист.</p>
  </div>
</section>
<dialog class="trace-panel" id="guide" aria-labelledby="guide-title"><div class="panel-head"><span class="mini-label">Инструкция</span><button type="button" data-close-dialog class="icon-button" aria-label="Закрыть инструкцию">${close}</button></div><h2 id="guide-title">Как запустить проверку</h2><div id="guide-body"></div><div class="panel-foot"><button type="button" class="button button-light" data-close-dialog><span class="button-label"><span data-label="Закрыть">Закрыть</span></span></button></div></dialog>`;
