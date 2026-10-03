import {arrow,arrowOut,asterisk} from './icons.mjs';

const guides = [
  {
    id:'journaltrace',num:'01',name:'JournalTrace',kind:'История файлов',source:'https://github.com/ponei/JournalTrace/releases/tag/1.0',
    summary:'Показывает записи журнала NTFS о создании, удалении и переименовании файлов.',
    steps:['Скачайте релиз со страницы автора и откройте программу на своём ПК.','Выберите нужный NTFS-диск и дождитесь чтения журнала.','Ищите точное имя файла или папки, затем сопоставьте путь и время с проверяемой игрой.'],
    limit:'Запись USN говорит об изменении файла, а не о запуске программы.'
  },
  {
    id:'everything',num:'02',name:'Everything',kind:'Поиск файлов',source:'https://www.voidtools.com/',
    summary:'Быстро находит файлы и папки по имени на проиндексированных дисках.',
    steps:['Установите Everything с сайта разработчика и дождитесь индексации.','Введите одно точное название из блока «Названия» на странице проверки, например Osiris или Nursultan.','Откройте расположение находки и проверьте, относится ли оно к активной сборке игры.'],
    limit:'Совпадение имени файла не доказывает, что его запускали или использовали в игре.'
  },
  {
    id:'system-informer',num:'03',name:'System Informer',kind:'Запущенные процессы',source:'https://systeminformer.io/',
    summary:'Показывает запущенные процессы и помогает искать загруженные DLL и открытые дескрипторы.',
    steps:['Откройте программу с сайта разработчика во время работы проверяемой игры.','Найдите процесс игры и посмотрите путь к исполняемому файлу.','Используйте Ctrl+F для поиска известного имени DLL или пути и проверьте процесс-владелец.'],
    limit:'Отсутствие результата не исключает инъекцию; неизвестная DLL может принадлежать легальному ПО.'
  },
  {
    id:'prefetch',num:'04',name:'WinPrefetchView',kind:'След запуска EXE',source:'https://www.nirsoft.net/utils/win_prefetch_view.html',
    summary:'Читает файлы Prefetch и показывает Last Run Time и Run Counter для исполняемых файлов.',
    steps:['Скачайте утилиту с сайта NirSoft и откройте её; чтение системного Prefetch может потребовать права администратора.','Найдите точное имя EXE и проверьте Last Run Time и Run Counter.','Сопоставьте время с игровым сеансом и полным путём файла.'],
    limit:'Это след запуска EXE, но он не доказывает, что чит применяли в матче. Отсутствие записи тоже ничего не оправдывает.'
  },
  {
    id:'shellbags',num:'05',name:'Shellbag Analyzer',kind:'История папок',source:'https://privazer.com/en/download-shellbag-analyzer-shellbag-cleaner.php',
    summary:'Показывает следы папок, которые открывали через оболочку Windows.',
    steps:['Скачайте программу с сайта автора и откройте режим Analyzer.','Просмотрите пути папок, относящиеся к игре или найденному файлу.','Запишите путь и время для дальнейшей сверки с другими следами.'],
    limit:'Наличие папки в Shellbags не подтверждает запуск файла. Режим Cleaner для диагностики не нужен.'
  },
  {
    id:'regscanner',num:'06',name:'RegScanner / RecentFilesView',kind:'Контекст Windows',source:'https://www.nirsoft.net/utils/regscanner.html',secondary:'https://www.nirsoft.net/utils/recent_files_view.html',
    summary:'RegScanner ищет строку в реестре; RecentFilesView показывает историю недавно открытых файлов.',
    steps:['Скачайте обе утилиты с сайта NirSoft.','В RegScanner ищите точное название или путь, не меняя записи.','В RecentFilesView сопоставьте открытые файлы со временем проверки и другим источником.'],
    limit:'Запись в реестре или недавний файл дают контекст, но не доказывают, что чит запускали. Не используйте функции удаления.'
  },
  {
    id:'funmod',num:'07',name:'FunModAnalyzer',kind:'Minecraft / FunTime',source:'https://github.com/denischifer/FunModAnalyzer/releases/tag/v1.0.2',
    summary:'Инструмент для просмотра модификаций Minecraft, указанный в правилах FunTime.',
    steps:['Скачайте релиз, на который ссылается FunTime, а не бинарник от постороннего человека.','Проверьте именно папку запущенной сборки Minecraft.','Сверьте найденные моды с текущим списком разрешённых и запрещённых модификаций FunTime.'],
    limit:'Правила FunTime не распространяются автоматически на SpookyTime, ReallyWorld и HolyWorld.'
  },
  {
    id:'ocean',num:'08',name:'Ocean Anti-Cheat',kind:'Проверка по PIN',source:'https://anticheat.ac/downloads',
    summary:'Сканер, который FunTime упоминает среди средств проверки; сценарий требует PIN от проверяющего.',
    steps:['При официальной проверке получите PIN от уполномоченного проверяющего.','Скачайте клиент только с anticheat.ac и следуйте его интерфейсу.','Результат разбирайте по правилам сервера; общие и подозрительные находки требуют ручной оценки.'],
    limit:'Не запускайте такой сканер по ссылке или PIN от неизвестного лица; Trace не получает результаты Ocean.'
  }
];

const external = (href,label,className='') => `<a${className?` class="${className}"`:''} href="${href}" target="_blank" rel="noopener noreferrer">${label} ${arrowOut}</a>`;
const guideCard = item => `<article class="tool-guide" id="${item.id}" data-reveal><div class="tool-guide-heading"><div><span class="mini-label">${item.kind}</span><h2>${item.name}</h2></div>${external(item.source,'Сайт программы','tool-guide-source')}</div><p class="tool-guide-summary">${item.summary}</p><ol>${item.steps.map(step=>`<li>${step}</li>`).join('')}</ol><p class="tool-guide-limit"><strong>Ограничения.</strong> ${item.limit}</p>${item.secondary?external(item.secondary,'Сайт RecentFilesView','tool-guide-secondary'):''}</article>`;

export const toolsPage = `<section class="page-intro container tools-intro"><p class="eyebrow">Программы для проверки</p><div class="intro-row"><h1>Инструменты<span class="accent-dot">.</span></h1><p>Что открыть, где скачать и как понимать результат. Каждая программа показывает своё, и ни одна не выносит вердикт.</p></div></section><div class="tools-layout container"><aside class="tools-rail"><span class="mini-label">Разделы</span><nav aria-label="Инструменты"><span class="rail-lens" aria-hidden="true"></span>${guides.map(item=>`<a href="#${item.id}">${item.name}</a>`).join('')}</nav><a class="text-link aside-link" href="check.html">К командам ${arrow}</a></aside><div class="tools-content"><div class="tools-alert"><span class="tools-alert-mark" aria-hidden="true">${asterisk}</span><p><strong>Качайте только с официальных сайтов.</strong> Часть этих программ упоминается в правилах и инструкциях FunTime и ReallyWorld. При удалённой проверке действуют правила сервера. ${external('https://reallyworld.ru/anydesk','ReallyWorld запрещает проверяющему запускать CMD/PowerShell через AnyDesk')}</p></div>${guides.map(guideCard).join('')}<div class="tools-source"><span class="mini-label">Правила и источники</span>${external('https://funtime.su/rules','Правила FunTime')}${external('https://forum.funtime.su/modifications','Список модификаций FunTime')}${external('https://reallyworld.ru/anydesk','Порядок ReallyWorld')}${external('https://learn.microsoft.com/en-us/windows/win32/fileio/change-journal-records','Что фиксирует журнал NTFS')}</div></div></div>`;
