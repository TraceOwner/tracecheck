'use strict';

// Commands come from commands.js; this file is the page around them: game, method, task, copy.
const {games, tasks, about, commandPieces, fileFor} = window.TraceCommands;

const consent = 'Запускайте только на своём ПК или с ясного согласия владельца. При удалённой проверке действуют правила сервера: ReallyWorld, например, запрещает проверяющему самому открывать CMD или PowerShell через AnyDesk.';
const artNote = 'Первое копирование даёт команду с заставкой TRACE. Следующие копирования той же команды идут без заставки, так повторный запуск короче.';
// Numbered are only the steps a person takes in order; the rest are notes around them.
const methods = {
  powershell: {
    terminal: 'Windows PowerShell', prompt: 'PS >', guideTitle: 'Как запустить проверку в PowerShell',
    steps: [
      'Откройте Windows PowerShell от имени администратора: Win+X, затем «Терминал (администратор)» или «Windows PowerShell (администратор)».',
      'Выберите задачу и прочитайте команду.',
      'Скопируйте её, вставьте в окно PowerShell и нажмите Enter.'
    ],
    notes: ['Без прав администратора команда тоже работает, но часть источников пропустит и перечислит их в конце.', artNote]
  },
  cmd: {
    terminal: 'Командная строка Windows', prompt: 'C:\\>', guideTitle: 'Как запустить проверку в CMD',
    steps: [
      'Откройте командную строку от имени администратора: Пуск, введите cmd, затем «Запуск от имени администратора».',
      'Выберите задачу и прочитайте команду.',
      'Скопируйте её, вставьте в окно целиком (это одна строка) и нажмите Enter.'
    ],
    notes: [
      'Команда запускает Windows PowerShell (powershell -NoProfile -Command) и делает то же, что команда на вкладке PowerShell.',
      '«Всё сразу» не помещается в одну строку CMD (предел 8191 символ), поэтому эта задача запускает скачанный файл полной проверки из папки «Загрузки». Ключ -ExecutionPolicy Bypass действует только на этот запуск и не меняет настройки Windows.',
      artNote
    ]
  },
  manual: {}
};
const tracePro = 'В Minecraft «Всё сразу» — это сценарий TRACE-PRO. После проверки он откроет меню: 1–4 — другие режимы, 5 — сохранить отчёт в JSON и CSV, 0 — выход. В отчёте могут быть личные пути, имя пользователя и аргументы Java (ключ сессии и идентификаторы учётной записи в них заменены звёздочками): откройте файлы и проверьте их, прежде чем отправлять.';
const manualGuide = {
  minecraft: 'Откройте Диспетчер задач (Ctrl+Shift+Esc), затем папку той сборки Minecraft, которая сейчас запущена. Посмотрите mods и versions и сравните моды с правилами сервера. У FunTime и остальных серверов правила разные.',
  gta: 'Откройте Диспетчер задач (Ctrl+Shift+Esc), затем папку FiveM (%LOCALAPPDATA%\\FiveM\\FiveM.app) и папку игры. Посмотрите plugins и mods и сравните найденное с правилами сервера: у каждого проекта свой список разрешённого.',
  cs2: 'В Steam откройте свойства CS2 → Установленные файлы → Проверить целостность. Потом посмотрите процессы и папку %APPDATA%\\OsirisCS2\\configs. Проверка в Steam память игры не анализирует.'
};
const aboutTask = (gameKey, taskKey) => gameKey === 'minecraft' && taskKey === 'all'
  ? 'Сценарий TRACE-PRO: все задачи из списка, кроме «Все диски», с оценкой каждой находки. После проверки откроется меню, где пункт 5 сохраняет отчёт.'
  : about[taskKey];

const el = id => document.getElementById(id);
const {Spring, Motion, Lens, Morph, animate, materialize, morphHeight, reduced, clamp, mix, smooth} = window.TraceMotion;
const tabs = [...document.querySelectorAll('.tool-tab')];
let activeMethod = 'powershell';
let activeGame = null;
let activeTask = 'all';

// Short labels swap like a split-flap: the old line leaves, the new one lands. Each travels its whole height, so the
// two never sit on top of each other halfway.
function swapText(frame, span, text, direction = 1) {
  if (span.textContent === text) return;
  if (reduced()) { span.textContent = text; return; }
  const ghost = span.cloneNode(true);
  ghost.removeAttribute('id'); ghost.setAttribute('aria-hidden', 'true');
  ghost.style.cssText = 'position:absolute;left:0;top:0;right:0;pointer-events:none';
  frame.append(ghost);
  span.textContent = text;
  animate(ghost, [{transform: 'none', opacity: 1, filter: 'blur(0)'}, {transform: `translateY(${-110 * direction}%)`, opacity: 0, filter: 'blur(3px)'}], {duration: 300, easing: TraceMotion.curves.inout}).then(() => ghost.remove());
  animate(span, [{transform: `translateY(${110 * direction}%)`, opacity: 0, filter: 'blur(3px)'}, {transform: 'none', opacity: 1, filter: 'blur(0)'}], {spring: 'snappy', fill: 'backwards'});
}
// Sets a text and says whether it changed: only what changed is animated.
const setText = (node, text) => { if (node.textContent === text) return false; node.textContent = text; return true; };

/* ───── Names: the list the selected game's commands search, straight from commands.js ───── */
function renderNames(gameKey) {
  const game = games[gameKey], names = game.terms(), weak = new Set(game.weak());
  el('names-count').textContent = String(names.length);
  el('names-source').textContent = `${game.source}${weak.size ? ' Пунктиром отмечены общие слова, имена и обычные программы: совпадение с ними часто ложное, поэтому они ищутся только отдельным словом.' : ''}`;
  el('names-list').replaceChildren(...names.map(name => {
    const item = document.createElement('li');
    item.textContent = name;
    if (weak.has(name)) {
      item.className = 'is-weak';
      const note = document.createElement('span');
      note.className = 'visually-hidden'; note.textContent = ' (возможно ложное совпадение)';
      item.append(note);
    }
    return item;
  }));
  const jar = game.jar?.();
  el('names-jar').hidden = !jar;
  if (jar) el('names-jar').textContent = `Внутри JAR ищутся пакеты (папки в архиве): ${jar.join(', ')}.`;
}

const terminalBody = document.querySelector('.terminal-body');
const syncTerminalEdge = () => terminalBody.classList.toggle('is-clipped', terminalBody.scrollHeight - terminalBody.scrollTop - terminalBody.clientHeight > 4);
terminalBody.addEventListener('scroll', syncTerminalEdge, {passive: true});

/* ───── Command: what the terminal shows is exactly what the copy button copies ───── */
// The TRACE art comes with the first copy of each command (method, game and task); later copies come without it.
const copiedOnce = new Set();
const commandKey = () => `${activeMethod}:${el('game').value}:${activeTask}`;
const currentPieces = () => commandPieces(el('game').value, activeMethod, activeTask, !copiedOnce.has(commandKey()));
const currentCommand = () => currentPieces().join('');
const artGlyphs = /[█╗╔╝╚═║]/;
let shownCommand = '';
// Each piece is a span: the text of all of them together is exactly the copied command (generated line breaks of a
// one-line CMD command are CSS ::after content, which is neither text nor selected).
function showCommand({flash = false} = {}) {
  const pieces = currentPieces(), next = pieces.join('');
  if (next === shownCommand) return false;
  shownCommand = next;
  const code = el('command');
  code.classList.toggle('is-oneline', !/[\r\n]/.test(next));
  code.replaceChildren(...pieces.map(piece => {
    const span = document.createElement('span');
    span.className = artGlyphs.test(piece) ? 'cmd-line cmd-art' : 'cmd-line';
    span.textContent = piece;
    return span;
  }));
  terminalBody.scrollTop = 0;
  syncTerminalEdge();
  if (!flash && typeof resetCopied === 'function') resetCopied();
  if (flash && !reduced()) animate(el('command'), [{opacity: 0, filter: 'blur(4px)', transform: 'translateY(6px)'}, {opacity: 1, filter: 'blur(0)', transform: 'none'}], {spring: 'snappy', fill: 'backwards'});
  return true;
}

/* ───── Tasks: one radio per source; the list depends on the game (JAR classes are Minecraft only) ───── */
const taskGrid = el('task-grid');
// Returns whether the chips were rebuilt (GTA V RP and CS2 share one set, so switching between them rebuilds nothing).
function renderTasks(gameKey) {
  const keys = games[gameKey].tasks;
  if (!keys.includes(activeTask)) activeTask = 'all';
  if (taskGrid.dataset.keys === keys.join()) {
    taskGrid.querySelectorAll('input').forEach(input => { input.checked = input.value === activeTask; });
    return false;
  }
  taskGrid.dataset.keys = keys.join();
  taskGrid.replaceChildren(...keys.map(key => {
    const label = document.createElement('label');
    label.className = 'task-chip';
    label.innerHTML = '<input type="radio" name="task" autocomplete="off"><span class="task-dot" aria-hidden="true"></span><span class="task-copy"><strong></strong><small></small></span>';
    const input = label.querySelector('input');
    input.value = key; input.checked = key === activeTask;
    label.querySelector('strong').textContent = tasks[key].title;
    label.querySelector('small').textContent = tasks[key].note;
    return label;
  }));
  return true;
}
// Brings the right column up to date and returns what visibly changed.
function syncTask() {
  const gameKey = el('game').value, task = tasks[activeTask], cmdFile = activeMethod === 'cmd' && activeTask === 'all';
  const changed = [];
  if (setText(el('task-about'), aboutTask(gameKey, activeTask))) changed.push(el('task-about'));
  setText(el('command-scope'), task.admin ? 'Лучше запускать от имени администратора' : 'Работает без прав администратора');
  const hint = el('task-hint'), wasHidden = hint.hidden;
  hint.hidden = !cmdFile;
  if (cmdFile && (setText(hint, `Команда запускает самый новый файл ${fileFor(gameKey).replace('.ps1', '*.ps1')} из папки «Загрузки»: сначала скачайте его кнопкой ниже.`) || wasHidden)) changed.push(hint);
  el('download').href = `scripts/${fileFor(gameKey)}`;
  el('download').download = fileFor(gameKey);
  if (showCommand()) changed.push(terminalBody);
  return changed;
}
// Everything in the right column that can move when its height changes; morphHeight slides each from where it was.
const panelParts = () => [...el('command-content').children, ...el('manual-content').children, document.querySelector('.check-note')];
taskGrid.addEventListener('change', event => {
  const input = event.target.closest('input[name=task]');
  if (!input) return;
  activeTask = input.value;
  let changed = [];
  morphHeight(el('tool-panel'), () => { changed = syncTask(); }, {inside: panelParts()});
  if (!reduced()) animate(input.closest('.task-chip'), [{transform: 'scale(.95)', filter: 'brightness(1.8)'}, {transform: 'none', filter: 'brightness(1)'}], {spring: 'bouncy', fill: 'none'});
  materialize(changed, {stagger: 40});
});

function renderSelection({animated = true} = {}) {
  const method = methods[activeMethod], manual = activeMethod === 'manual';
  const gameKey = el('game').value, gameChanged = activeGame !== gameKey, wasManual = el('command-content').hidden;
  activeGame = gameKey;
  let changed = [];
  const apply = () => {
    document.body.dataset.game = gameKey;
    el('command-content').hidden = manual;
    el('manual-content').hidden = !manual;
    // The note speaks about command results; the checklist has its own words.
    document.querySelector('.check-note').hidden = manual;
    const guideChanged = setText(el('manual-guide'), manualGuide[gameKey]);
    if (gameChanged) renderNames(gameKey);
    const gridChanged = renderTasks(gameKey);
    if (manual) {
      if (!wasManual) changed.push(el('manual-content'));
      else if (guideChanged) changed.push(el('manual-guide'));
      return;
    }
    if (wasManual) changed.push(el('command-content'));
    if (gridChanged) changed.push(taskGrid);
    const titleChanged = setText(el('terminal-title'), method.terminal);
    el('prompt').textContent = method.prompt;
    const synced = syncTask();
    if (!wasManual) changed.push(...(titleChanged ? [el('terminal-title')] : []), ...synced);
  };
  if (!animated) { apply(); return; }
  morphHeight(el('tool-panel'), apply, {inside: panelParts()});
  materialize(changed, {stagger: 38});
}

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
    gameDivider.style.opacity=(smooth(4,20,reach-gameRowHeight)*c).toFixed(3);
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

let gameRowHeight=50;
function layoutGame(){
  const W=gameTrigger.offsetWidth,H=gameTrigger.offsetHeight,pad=6;
  gameRowHeight=H;
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
new ResizeObserver(()=>{layoutGame();gameMorph.snap(gameOpen);}).observe(gameTrigger);

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
  if(gameOpen&&((event.key==='ArrowUp'&&event.altKey)||event.key==='Tab')){
    if(event.key!=='Tab')event.preventDefault();
    chooseGame(activeGameOption);return;
  }
  if(event.key==='PageUp'||event.key==='PageDown'){
    event.preventDefault();if(!gameOpen)openGameOptions();
    setActiveGameOption(event.key==='PageUp'?0:gameOptionNodes.length-1);return;
  }
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
  if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
    const key=event.key.toLocaleLowerCase();
    // The same letter again moves to the next option that starts with it.
    typeahead=typeahead===key?key:typeahead+key;clearTimeout(typeaheadTimer);
    typeaheadTimer=setTimeout(()=>{typeahead='';},700);
    const labels=gameOptionNodes.map(option=>option.querySelector('.game-option-label').textContent.toLocaleLowerCase());
    const start=typeahead.length===1&&gameOpen?activeGameOption+1:0;
    const order=[...labels.keys()].map(i=>(start+i)%labels.length);
    const index=order.find(i=>labels[i].startsWith(typeahead));
    if(index!==undefined){if(!gameOpen)openGameOptions();setActiveGameOption(index);}
  }
});
document.addEventListener('pointerdown',event=>{if(gameOpen&&!gameSelect.contains(event.target))closeGameOptions();});
gamePicker.addEventListener('focusout',()=>requestAnimationFrame(()=>{if(!gamePicker.contains(document.activeElement))closeGameOptions();}));
el('game-label').addEventListener('click',()=>{gameTrigger.focus();openGameOptions();});
nativeGame.addEventListener('change',()=>{
  syncGameChoice();
  document.querySelectorAll('.manual-list input').forEach(input=>{input.checked=false;});
  renderSelection();
});
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
// The label window keeps the width of the longest label (measured once), so the labels swap in place: the icon
// does not move and the leaving label is never cut.
function setCopyLabel(text,direction){
  const frame=copyLabel.parentElement;
  // The layout width, not the box on screen: right after a click the button is still scaled down by :active.
  if(!frame.style.width)frame.style.width=`${Math.ceil(parseFloat(getComputedStyle(frame).width))}px`;
  swapText(frame,copyLabel,text,direction);
}
function confirmCopy(detail){
  clearTimeout(copyTimer);
  copyButton.classList.add('is-copied');
  setCopyLabel('Скопировано',1);
  const terminal=el('terminal');
  terminal.classList.remove('is-captured');void terminal.offsetWidth;terminal.classList.add('is-captured');
  TraceUI.notify({title:'Команда скопирована',detail});
  copyTimer=setTimeout(()=>{copyButton.classList.remove('is-copied');setCopyLabel('Скопировать команду',-1);},2400);
}
el('terminal').addEventListener('animationend',event=>{if(event.pseudoElement==='::after')el('terminal').classList.remove('is-captured');});
let copying=false;
copyButton.addEventListener('click',async event=>{
  // A double click is one copy: the second click would replace the command with art by the one without it.
  if(copying||event.detail>1)return;
  const key=commandKey(),repeat=copiedOnce.has(key);
  // After the first copy the terminal keeps showing the copied text; a repeat copy first redraws it without the art,
  // so the page again shows exactly what goes to the clipboard.
  if(repeat&&shownCommand!==currentCommand())showCommand({flash:true});
  copying=true;
  try{
    await navigator.clipboard.writeText(shownCommand);
    copiedOnce.add(key);
    confirmCopy(repeat?'Без заставки: так повторный запуск короче':'Проверьте её перед запуском');
  }catch{
    const range=document.createRange(); range.selectNodeContents(el('command'));
    const selection=window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    TraceUI.notify({title:'Команда выделена',detail:'Нажмите Ctrl+C, чтобы скопировать'});
  }finally{copying=false;}
});
// «Скопировано» belongs to the command that was copied: another command in the terminal takes the label back.
function resetCopied(){
  if(!copyButton.classList.contains('is-copied'))return;
  clearTimeout(copyTimer);copyButton.classList.remove('is-copied');setCopyLabel('Скопировать команду',-1);
}

el('instructions').addEventListener('click',event=>{
  const method=methods[activeMethod],gameKey=el('game').value;
  el('guide-title').textContent=method.guideTitle;
  const paragraph=text=>{const p=document.createElement('p');p.textContent=text;return p;};
  const list=document.createElement('ol');
  for(const step of method.steps){const item=document.createElement('li');item.textContent=step;list.append(item);}
  const notes=[...method.notes,gameKey==='minecraft'&&activeTask==='all'?tracePro:null].filter(Boolean).map(paragraph);
  el('guide-body').replaceChildren(paragraph(consent),list,...notes);
  TraceUI.openDialog(el('guide'),event.currentTarget);
});

el('export-checklist').addEventListener('click',()=>{
  const lines=[...document.querySelectorAll('.manual-list label')].map(label=>`[${label.querySelector('input').checked?'x':' '}] ${label.querySelector('.check-text').textContent}`);
  const report='﻿Trace, ручная проверка\r\nДата: '+new Date().toLocaleString('ru-RU')+' (местное время)'+'\r\nИгра: '+el('game').selectedOptions[0].textContent+'\r\n\r\n'+lines.join('\r\n')+'\r\n\r\n'+manualGuide[el('game').value]+'\r\n\r\nЭто отметки пользователя, а не автоматический вывод о нарушении.\r\n';
  const url=URL.createObjectURL(new Blob([report],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='TRACE-checklist.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  TraceUI.notify({title:'Чек-лист подготовлен',detail:'Файл TRACE-checklist.txt сохраняется'});
});

const initial=new URLSearchParams(location.search);
// Only real choices from the address: not inherited keys like toString or __proto__.
const wantedGame=initial.get('game'),wantedMethod=initial.get('method'),wantedTask=initial.get('task');
if(Object.hasOwn(games,wantedGame))el('game').value=wantedGame;
if(Object.hasOwn(tasks,wantedTask)&&games[el('game').value].tasks.includes(wantedTask))activeTask=wantedTask;
syncGameChoice();
selectMethod(['powershell','cmd','manual'].includes(wantedMethod)?wantedMethod:'powershell',{animated:false});
addEventListener('pageshow',()=>{
  if(gameValue.textContent===nativeGame.selectedOptions[0].textContent&&activeGame===nativeGame.value)return;
  syncGameChoice();renderSelection({animated:false});
});

if(navigator.modelContext?.registerTool){
  navigator.modelContext.registerTool({name:'select_check_method',description:'Select a TRACE instruction method, game and task. This only changes the visible page; it does not execute commands or read the computer.',inputSchema:{type:'object',properties:{method:{type:'string',enum:['powershell','cmd','manual']},game:{type:'string',enum:Object.keys(games)},task:{type:'string',enum:Object.keys(tasks)}},required:['method'],additionalProperties:false},execute:async({method,game,task})=>{if(!['powershell','cmd','manual'].includes(method)||(game&&!Object.hasOwn(games,game))||(task&&!Object.hasOwn(tasks,task)))throw new Error('Unknown method, game or task');if(game){el('game').value=game;syncGameChoice();}if(task&&games[el('game').value].tasks.includes(task))activeTask=task;renderSelection();selectMethod(method);return{content:[{type:'text',text:`${method} / ${el('game').value} / ${activeTask}`}]}}});
}
