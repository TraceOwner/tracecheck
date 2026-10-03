import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';

const source=readFileSync(resolve('src/check.js'),'utf8').split('const el = id =>')[0];
const context={window:{}};
vm.runInNewContext(readFileSync(resolve('dist/minecraft-command.js'),'utf8'),context,{filename:'dist/minecraft-command.js'});
vm.runInNewContext(`${source}\nglobalThis.traceCommands={games,commandFor,depthLevels};`,context,{filename:'src/check.js'});
const {games,commandFor,depthLevels}=context.traceCommands;
const folder=mkdtempSync(join(tmpdir(),'trace-command-check-'));
const parse=(label,command)=>{
  const path=join(folder,`${label}.ps1`);
  writeFileSync(path,String.fromCharCode(0xfeff)+command,'utf8');
  const escaped=path.replaceAll("'","''");
  const parser=`$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile('${escaped}',[ref]$tokens,[ref]$errors)|Out-Null;if($errors){$errors|ForEach-Object{Write-Error $_.Message};exit 1}`;
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',parser],{encoding:'utf8'});
  if(result.status!==0)throw new Error(`${label}: ${result.stderr||result.stdout||result.error}`);
};
try {
  // Every Minecraft depth is parsed; none is executed, so no system scan runs here.
  for(const {key} of depthLevels){
    for(const intro of [true,false]){
      const command=commandFor('minecraft','powershell',intro,key);
      if(!command.includes(`$Preset = '${key}'`)||!command.includes("'quick' = 'Q'"))throw new Error(`minecraft ${key}: preset wiring missing`);
      parse(`minecraft-${key}-${intro?'intro':'plain'}`,command);
    }
  }
  for(const game of Object.keys(games)){
    for(const intro of [true,false]){
      const command=commandFor(game,'powershell',intro);
      const hasMenu=game==='minecraft'
        ? command.includes('Audit-FileSystemPaths') && command.includes('TRACE-PRO > [0-5]')
        : command.includes('Find-TraceFiles') && command.includes("$choice -eq '3'");
      if(!hasMenu)throw new Error(`${game}: menu missing`);
      const path=join(folder,`${game}-${intro?'intro':'plain'}.ps1`);
      // Windows PowerShell 5.1 reads a .ps1 without BOM as the system ANSI code page.
      writeFileSync(path,'\ufeff'+command,'utf8');
      const escaped=path.replaceAll("'","''");
      const parser=`$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile('${escaped}',[ref]$tokens,[ref]$errors)|Out-Null;if($errors){$errors|ForEach-Object{Write-Error $_.Message};exit 1}`;
      const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',parser],{encoding:'utf8'});
      if(result.status!==0)throw new Error(`${game} ${intro?'intro':'plain'}: ${result.stderr||result.stdout||result.error}`);
      if(game==='minecraft' && !intro){
        const fixture=join(folder,'sample-game');
        mkdirSync(fixture);
        writeFileSync(join(fixture,'nursultan-fixture.jar'),'synthetic test fixture');
        const fixtureScript=join(folder,'fixture.ps1');
        writeFileSync(fixtureScript,'\ufeff'+command,'utf8');
        const scan=spawnSync('powershell.exe',['-NoProfile','-File',fixtureScript],{input:`4\r\n${fixture}\r\n0\r\n`,encoding:'utf8',timeout:20000});
        if(scan.status!==0 || !scan.stdout.includes('nursultan-fixture.jar'))throw new Error(`Synthetic folder scan failed: ${scan.stderr||scan.error||scan.stdout}`);
      }
    }
    const cmd=commandFor(game,'cmd',false);
    if(!games[game].cmdIndicators.every(name=>cmd.toLowerCase().includes(name.toLowerCase())))throw new Error(`${game}: CMD names missing`);
  }
  // TRACE-PRO must never show or save launcher secrets from Java command lines, and must keep paths intact.
  const pro=readFileSync(resolve('src/trace-pro-minecraft.ps1'),'utf8');
  const protect=pro.slice(pro.indexOf('function Protect-CommandLine'),pro.indexOf('function Audit-JavaProcessesAndInjections'));
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
  const redactScript=join(folder,'redact.ps1');
  writeFileSync(redactScript,'\ufeff'+protect+'\n'+redactCases.map(([line])=>`Protect-CommandLine '${('javaw.exe '+line).replaceAll("'","''")}'`).join('\n'),'utf8');
  const redacted=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',redactScript],{encoding:'utf8'});
  const lines=redacted.stdout.trim().split(/\r?\n/);
  if(redacted.status!==0||lines.length!==redactCases.length)throw new Error(`Redaction test did not run: ${redacted.stderr||redacted.stdout}`);
  redactCases.forEach(([line,keep],i)=>{
    if(/SECRET/.test(lines[i]))throw new Error(`Secret left in: ${lines[i]}`);
    keep.forEach(part=>{ if(!lines[i].includes(part))throw new Error(`Redaction removed "${part}": ${lines[i]}`); });
  });
  console.log(`TRACE command syntax: 6 PowerShell variants and ${depthLevels.length*2} Minecraft depth presets parsed; Minecraft fixture scan, 3 CMD name sets and ${redactCases.length} redaction cases verified.`);
} finally {
  if(dirname(folder)!==tmpdir()||!basename(folder).startsWith('trace-command-check-'))throw new Error('Unsafe temporary test path');
  rmSync(folder,{recursive:true,force:true});
}
