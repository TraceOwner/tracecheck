// Checks every command check.html can show. Run after `npm run build`: node scripts/verify-commands.mjs
// Uses Windows PowerShell on Windows and pwsh elsewhere (set POWERSHELL to override). On every system it parses all
// commands and files, checks the cmd.exe limits and the art rule and runs the name, JAR and redaction cases on
// synthetic folders. On Windows it also runs a command through a real cmd.exe and TRACE-PRO's folder mode. No real
// system scan runs: every executed command is pointed at a temporary folder.
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';

const windows=process.platform==='win32';
const shell=process.env.POWERSHELL||(windows?'powershell.exe':'pwsh');
const context={window:{}};
vm.runInNewContext(readFileSync(resolve('dist/minecraft-command.js'),'utf8'),context,{filename:'dist/minecraft-command.js'});
vm.runInNewContext(readFileSync(resolve('src/commands.js'),'utf8'),context,{filename:'src/commands.js'});
const {games,command,fileFor}=context.window.TraceCommands;
const folder=mkdtempSync(join(tmpdir(),'trace-command-check-'));
const fail=message=>{throw new Error(message);};
// Windows PowerShell 5.1 reads a .ps1 without BOM in the system ANSI code page.
const writeScript=(name,text)=>{const path=join(folder,name);writeFileSync(path,'\ufeff'+text,'utf8');return path;};
const run=(args,options={})=>spawnSync(shell,['-NoProfile','-NonInteractive',...args],{encoding:'utf8',timeout:120000,...options});
const art='████████╗';
try {
  const parseDir=join(folder,'parse'),pairDir=join(folder,'pairs');mkdirSync(parseDir);mkdirSync(pairDir);
  let count=0;
  for(const [gameKey,game] of Object.entries(games)){
    for(const task of game.tasks){
      for(const method of ['powershell','cmd']){
        for(const intro of [true,false]){
          const text=command(gameKey,method,task,intro),label=`${gameKey}-${task}-${method}-${intro?'art':'plain'}`;
          const tracePro=gameKey==='minecraft'&&task==='all',fileRun=method==='cmd'&&task==='all';
          // The art rule: the first copy shows the TRACE art (TRACE-PRO and the .ps1 files: their intro), later copies do not.
          const withArt=tracePro||fileRun?!/-SkipIntro|\$SkipIntro = \$true/.test(text):text.includes(art);
          if(withArt!==intro)fail(`${label}: art does not follow the copy`);
          if(fileRun){
            const file=fileFor(gameKey);
            if(!text.includes(`-Filter '${file.replace(/\.ps1$/,'')}*.ps1'`)||!text.includes("NameSpace('shell:Downloads')"))fail(`${label}: does not look for ${file} in Downloads`);
            if(!existsSync(resolve('dist/scripts',file)))fail(`${label}: dist/scripts/${file} is missing`);
          }
          let body=text;
          if(method==='cmd'){
            const inner=text.match(/^powershell -NoProfile (?:-ExecutionPolicy Bypass )?-Command "(.*)"$/s)?.[1];
            if(inner===undefined)fail(`${label}: not a powershell -Command line`);
            if(/[\r\n]/.test(text))fail(`${label}: more than one line; cmd.exe runs each pasted line on its own`);
            if(text.length>8191)fail(`${label}: ${text.length} characters, cmd.exe takes 8191`);
            if(inner.includes('"'))fail(`${label}: a double quote ends the cmd.exe argument`);
            if(inner.includes('%'))fail(`${label}: % is expanded by cmd.exe`);
            if(inner.includes('!'))fail(`${label}: ! is eaten by cmd.exe when delayed expansion is on`);
            body=inner;
          }
          if(!tracePro&&!fileRun&&!game.terms().every(term=>body.includes(`'${term.replaceAll("'","''")}'`)))fail(`${label}: names missing`);
          writeFileSync(join(parseDir,`${label}.ps1`),'\ufeff'+body,'utf8');count++;
          // The one-line CMD text must parse into the same tree as the PowerShell tab: a misplaced ; still parses
          // (before else it makes "else" a command), so only the trees show it.
          if(method==='cmd'&&!fileRun){
            writeFileSync(join(pairDir,`${label}.cmd.ps1`),'\ufeff'+body,'utf8');
            writeFileSync(join(pairDir,`${label}.ps.ps1`),'\ufeff'+command(gameKey,'powershell',task,intro),'utf8');
          }
        }
      }
    }
  }
  for(const file of ['trace-pro-minecraft.ps1','trace-gta.ps1','trace-cs2.ps1']){
    const text=readFileSync(resolve('dist/scripts',file),'utf8');
    if(text.charCodeAt(0)!==0xfeff)fail(`${file}: no BOM`);
    writeFileSync(join(parseDir,file),text,'utf8');count++;
  }
  const parser=writeScript('parse.ps1',`param([string]$Dir)
$bad = 0
foreach ($file in Get-ChildItem -LiteralPath $Dir -Filter *.ps1) {
  $tokens = $null; $errors = $null
  [System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$errors) | Out-Null
  foreach ($e in $errors) { Write-Output ($file.Name + ': ' + $e.Message + ' @' + $e.Extent.StartOffset); $bad++ }
}
exit $bad`);
  const parsed=run(['-File',parser,'-Dir',parseDir]);
  if(parsed.status!==0)fail(`Parse errors:\n${parsed.stdout}${parsed.stderr}${parsed.error||''}`);
  const compare=writeScript('compare.ps1',`param([string]$Dir)
$bad = 0
foreach ($file in Get-ChildItem -LiteralPath $Dir -Filter *.cmd.ps1) {
  $tokens = $null; $errors = $null
  $line = [System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$errors)
  $tab = [System.Management.Automation.Language.Parser]::ParseFile(($file.FullName -replace '\\.cmd\\.ps1$', '.ps.ps1'), [ref]$tokens, [ref]$errors)
  $inner = $tab.EndBlock.Statements[0].PipelineElements[0].CommandElements[0].ScriptBlock
  $a = @($line.FindAll({ $true }, $true) | ForEach-Object { $_.GetType().Name }) -join ','
  $b = @($inner.FindAll({ $true }, $true) | ForEach-Object { $_.GetType().Name }) -join ','
  if ($a -ne $b) { Write-Output ($file.Name + ': the one-line text parses differently'); $bad++ }
}
exit $bad`);
  const compared=run(['-File',compare,'-Dir',pairDir]);
  if(compared.status!==0)fail(`CMD text differs from the PowerShell tab:\n${compared.stdout}${compared.stderr}${compared.error||''}`);

  // Name matching, the same rules in the page commands and in TRACE-PRO: distinctive names inside longer names, common
  // words only as a word, the Windows user folder never counts, a clear name wins over a common word in the same text.
  const nameCases=[
    ['NursultanClient.jar','nursultan'],['Expensive2.0.jar','expensive'],['thunderhackrecode.jar','thunderhack'],
    ['C:\\Program Files\\War Thunder\\win64\\aces.exe',''],['C:\\Users\\Nursultan\\AppData\\Local\\Discord\\Discord.exe',''],
    ['BitLocker Encryption','' ],['C:\\Games\\Rockstar Games\\nursultan.exe','nursultan'],['neko.png','neko'],
    ['C:\\Program Files (x86)\\SAPPHIRE\\TRIXX\\TriXX.exe','sapphire']
  ];
  const pro=readFileSync(resolve('src/trace-pro-minecraft.ps1'),'utf8');
  const proLists=pro.slice(pro.indexOf('    $cheatKeywords = @('),pro.indexOf('    $gameRoots = @('));
  const proMatch=pro.slice(pro.indexOf('    $strongTerms = '),pro.indexOf('    function Add-TraceHit'));
  const pageMatch=context.window.TraceCommands.coreLines('minecraft').join('\n');
  const nameScript=writeScript('names.ps1',`${proLists}\n${proMatch}\n${pageMatch}\n${nameCases.map(([text])=>{const t=`'${text.replaceAll("'","''")}'`;return `$hits.Clear(); Find-TraceName 'x' ${t} '' ''; $page = if ($hits.Count) { ($hits[0].Detail -split '[ ,;]')[1] } else { '' }; Write-Output ([string](Get-CheatMatch ${t}) + '|' + $page)`;}).join('\n')}`);
  const named=run(['-File',nameScript]);
  const answers=named.stdout.trim().split(/\r?\n/);
  if(named.status!==0||answers.length!==nameCases.length)fail(`Name cases did not run: ${named.stderr||named.stdout}`);
  nameCases.forEach(([text,want],i)=>{ if(answers[i]!==`${want}|${want}`)fail(`Name match for ${text}: expected ${want||'nothing'} (TRACE-PRO|page), got ${answers[i]}`); });

  // Synthetic folders: files named after cheats and harmless look-alikes, JARs with and without a cheat package, a JAR
  // that is not a ZIP. Each case lists what the output must and must not contain.
  const fixture=join(folder,'fixture'),mods=join(fixture,'appdata','.minecraft','mods');
  const classes=join(folder,'classes','ru','nursultan'),twilight=join(folder,'twilight','twilightforest','entity','passive');
  for(const dir of [mods,classes,twilight,join(fixture,'home','Downloads'),join(fixture,'local'),join(fixture,'tmp'),join(fixture,'appdata','OsirisCS2','configs')])mkdirSync(dir,{recursive:true});
  for(const name of ['nursultan-fixture.jar','NursultanClient.jar','aces.exe','Encryption.dll'])writeFileSync(join(mods,name),'synthetic test fixture');
  writeFileSync(join(fixture,'home','Downloads','Neverlose Loader.exe'),'synthetic test fixture');
  writeFileSync(join(fixture,'appdata','OsirisCS2','configs','legit.cfg'),'synthetic test fixture');
  writeFileSync(join(classes,'Main.class'),'synthetic test fixture');
  writeFileSync(join(twilight,'Raven.class'),'synthetic test fixture');
  const zipOf=(dir,name)=>run(['-Command',`Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory('${dir.replaceAll("'","''")}', '${join(mods,name).replaceAll("'","''")}')`]);
  for(const [dir,name] of [[join(folder,'classes'),'renamed-mod.jar'],[join(folder,'twilight'),'twilightforest.jar']]){const zip=zipOf(dir,name);if(zip.status!==0)fail(`Could not build the test JAR: ${zip.stderr}`);}
  const env={...process.env,APPDATA:join(fixture,'appdata'),LOCALAPPDATA:join(fixture,'local'),USERPROFILE:join(fixture,'home'),TEMP:join(fixture,'tmp')};
  const cases=[
    ['minecraft','folders',['nursultan-fixture.jar','NursultanClient.jar'],['aces.exe','Encryption.dll']],
    ['minecraft','jar',['ru/nursultan/Main.class'],['Raven.class','twilightforest.jar']],
    ['cs2','folders',['Neverlose Loader.exe','OsirisCS2'],[]]
  ];
  for(const [gameKey,task,expect,refuse] of cases){
    for(const method of ['powershell','cmd']){
      const text=command(gameKey,method,task,false);
      const result=method==='powershell'
        ?run(['-File',writeScript(`${gameKey}-${task}.ps1`,text)],{env})
        :windows
          ? spawnSync('cmd.exe',['/d','/s','/c',`"${text}"`],{encoding:'utf8',timeout:120000,env,windowsVerbatimArguments:true})
          : run(['-Command',text.match(/^powershell -NoProfile -Command "(.*)"$/s)[1]],{env});
      const missing=expect.filter(part=>!result.stdout.includes(part)),wrong=refuse.filter(part=>result.stdout.includes(part));
      if(result.status!==0||missing.length||wrong.length)fail(`${gameKey} ${task} (${method}): missing ${missing.join(', ')||'-'}, wrongly found ${wrong.join(', ')||'-'}:\n${result.stdout}${result.stderr}${result.error||''}`);
    }
  }
  if(windows){
    const pro=writeScript('fixture.ps1',command('minecraft','powershell','all',false).replace("$Preset = 'minecraft'","$Preset = 'menu'"));
    const scan=spawnSync(shell,['-NoProfile','-File',pro],{input:`4\r\n${mods}\r\n0\r\n`,encoding:'utf8',timeout:60000});
    if(scan.status!==0||!scan.stdout.includes('nursultan-fixture.jar'))fail(`TRACE-PRO folder scan failed: ${scan.stderr||scan.error||scan.stdout}`);
  }

  // TRACE-PRO must never show or save launcher secrets from Java command lines, and must keep paths intact.
  const source=readFileSync(resolve('src/trace-pro-minecraft.ps1'),'utf8');
  const protect=source.slice(source.indexOf('function Protect-CommandLine'),source.indexOf('function Audit-JavaProcessesAndInjections'));
  const redactCases=[
    ['--username Bob --accessToken eyJ.SECRET1 --uuid SECRET2 --xuid SECRET3 --clientId SECRET4',['Bob']],
    ['"--accessToken" "eyJ.SECRET5" "--uuid" "SECRET6"',[]],
    ['--launcherToken SECRET7 --token SECRET8 --password SECRET9 --secret SECRET10',[]],
    ['-Dauth.token=SECRET11 -Dminecraft.password="SECRET 12" -Dapi.secret: SECRET13',[]],
    ['--access-token SECRET14 --auth_token SECRET15 --authToken=SECRET16 --ACCESSTOKEN SECRET17',[]],
    ['--userProperties {"twitch_access_token":["SECRET18"]} --session token:SECRET19',[]],
    ['-cp C:\\Users\\tokenmaster\\a.jar;C:\\cheats\\nursultan.jar net.minecraft.Main',['tokenmaster','nursultan.jar']],
    ['-Dtoken: -javaagent:C:\\x\\nursultan.jar --accessToken SECRET20',['-javaagent:C:\\x\\nursultan.jar']]
  ];
  const redacted=run(['-File',writeScript('redact.ps1',protect+'\n'+redactCases.map(([line])=>`Protect-CommandLine '${('javaw.exe '+line).replaceAll("'","''")}'`).join('\n'))]);
  const lines=redacted.stdout.trim().split(/\r?\n/);
  if(redacted.status!==0||lines.length!==redactCases.length)fail(`Redaction test did not run: ${redacted.stderr||redacted.stdout}`);
  redactCases.forEach(([line,keep],i)=>{
    if(/SECRET/.test(lines[i]))fail(`Secret left in: ${lines[i]}`);
    keep.forEach(part=>{ if(!lines[i].includes(part))fail(`Redaction removed "${part}": ${lines[i]}`); });
  });
  console.log(`TRACE commands (${shell}): ${count} commands and files parsed; cmd.exe limits and the art rule checked; ${nameCases.length} name cases agree in TRACE-PRO and on the page; ${cases.length*2} synthetic scans${windows?' (CMD through cmd.exe) and the TRACE-PRO folder mode':''} found their fixtures; ${redactCases.length} redaction cases verified.`);
} finally {
  if(dirname(folder)!==tmpdir()||!basename(folder).startsWith('trace-command-check-'))throw new Error('Unsafe temporary test path');
  rmSync(folder,{recursive:true,force:true});
}
