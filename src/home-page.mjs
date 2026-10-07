import {toolIcon} from "./tool-icons.mjs";
import {arrow} from "./icons.mjs";

// One row per method: what it reads, whether it needs admin rights, where the result ends up.
// Every cell states a fact that the command or the checklist on check.html actually does.
// The link is the method's name; its ::after stretches over the row, so the whole row is clickable while a screen
// reader hears a short link name.
const method = (tool,title,lead,reads,rights,result) => `<li class="method-row" data-reveal><span class="method-name"><span class="method-icon ${tool}-icon" aria-hidden="true">${toolIcon(tool)}</span><span><a class="method-link" href="check.html?method=${tool}">${title}</a><em>${lead}</em></span></span><span class="method-cell"><small>Читает</small>${reads}</span><span class="method-cell"><small>Права</small>${rights}</span><span class="method-cell"><small>Результат</small>${result}</span>${arrow}</li>`;
const game = (key,title,note) => `<li data-reveal><a href="check.html?game=${key}" class="game-row"><strong class="game-name">${title}</strong><small>${note}</small>${arrow}</a></li>`;

export const homePage = `
<section class="cinema-hero" aria-labelledby="hero-title">
  <div class="cinema-art" aria-hidden="true"></div>
  <div class="cinema-vignette" aria-hidden="true"></div>
  <h1 id="hero-title" class="visually-hidden">TRACE — проверка на читы без установки</h1>
  <div class="cinema-word" aria-hidden="true"><img class="hero3d-poster" src="hero-poster.webp" srcset="hero-poster-960.webp 960w, hero-poster.webp 1914w, hero-poster-2870.webp 2870w" sizes="(max-width: 720px) 102vw, calc(3.7 * clamp(200px, min(29vw, 44vh), 540px))" alt="" width="1914" height="1254" fetchpriority="high" decoding="async"><span data-text="TRACE">TRACE</span></div>
  <div class="cinema-actions"><a class="button button-light" href="check.html"><span class="button-label"><span data-label="Открыть проверку">Открыть проверку</span></span>${arrow}</a><a class="cinema-text-link" href="methodology.html">Как читать результат ${arrow}</a></div>
</section>
<section id="methods" class="methods container" aria-labelledby="methods-title">
  <header class="methods-head"><p class="eyebrow">Способы проверки</p><h2 id="methods-title" class="display-m">Три способа<br><em>проверить ПК.</em></h2><p>Команда показана на странице целиком. Сначала прочитайте её, потом запускайте.</p></header>
  <ul class="methods-list">${method('powershell','PowerShell','Самая подробная проверка','Процессы, папки игры, Prefetch. Для Minecraft ещё реестр, журналы Windows и классы внутри JAR','Работает без них. С правами администратора видит больше','Список совпадений в окне. Для Minecraft отчёт JSON и CSV, если выбрать пункт 5')}${method('cmd','CMD','Короткая команда','Запущенные процессы, папки игры, «Загрузки», Prefetch','Лучше запускать от имени администратора','Список совпадений в окне. Скачиваемый .cmd сохраняет список процессов в CSV')}${method('manual','Вручную','Без терминала','То, что вы откроете сами: Диспетчер задач, папку игры, свойства файлов','Не нужны','Чек-лист с вашими отметками в файле .txt')}</ul>
</section>
<section class="night-statement" aria-labelledby="principle-title">
  <div class="night-ghost" aria-hidden="true"><span>совпадение</span></div>
  <div class="container"><p class="eyebrow">Принцип</p><h2 id="principle-title" class="statement-title"><span class="title-line">Совпадение имени</span><span class="title-line"><em>ещё не доказывает чит.</em></span></h2><div class="night-foot"><p>Trace показывает совпадения по названиям. Решение принимает человек: по правилам сервера и после разговора с игроком.</p><a class="text-link" href="methodology.html">Как разбирать находки ${arrow}</a></div></div>
</section>
<section class="ecosystem container" aria-labelledby="ecosystem-title">
  <header class="ecosystem-heading"><p class="eyebrow">Игры</p><h2 id="ecosystem-title" class="display-m">Своя проверка<br><em>для каждой игры.</em></h2><p>Названия и папки для поиска зависят от игры. Правила сервера сверяйте на его официальном сайте.</p></header>
  <ul class="ecosystem-list">${game('minecraft','Minecraft','FunTime, SpookyTime, ReallyWorld, HolyWorld')}${game('gta','GTA V RP','GTA5RP, Majestic')}${game('cs2','Counter-Strike 2','Процессы, файлы игры, Prefetch')}</ul>
  <a class="text-link ecosystem-all" href="projects.html">Официальные сайты и правила серверов ${arrow}</a>
</section>
<section class="final-cta" aria-labelledby="final-title"><div class="container"><h2 id="final-title" class="display-l">Проверка начинается<br><em>с одной команды.</em></h2><a class="button button-light" href="check.html"><span class="button-label"><span data-label="Открыть проверку">Открыть проверку</span></span>${arrow}</a><p class="field-hint" aria-hidden="true"><span></span>Водите курсором, чтобы закрутить нити. Клик даёт толчок</p></div></section>
`;
