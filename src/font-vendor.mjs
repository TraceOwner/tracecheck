import {writeFile,mkdir} from 'node:fs/promises';
const dir=new URL('../dist/fonts/',import.meta.url);
await mkdir(dir,{recursive:true});
const userAgent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
// Literata sets only the headings, so it is cut to the characters the site uses (Russian and Latin letters, digits,
// the punctuation and the ≠ ≈ signs) and to the weights in use (400–600): one 42 KB file instead of 82 KB in two.
// If a heading ever needs another character, add it here and run `node src/font-vendor.mjs`.
// Unbounded sets only the logo word, in one weight: it is cut to those characters (a few KB instead of 51 KB).
const literataText='АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюяABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?«»„“”"\'’—–-()[]/&%№≠≈+=*…·';
const families=[
 {query:`family=Unbounded:wght@700&text=${encodeURIComponent('TRACE.')}`,whole:true},
 {query:'family=IBM+Plex+Mono:wght@400;500;600'},
 {query:'family=Golos+Text:wght@400..800'},
 {query:`family=Literata:opsz,wght@60,400..600&text=${encodeURIComponent(literataText)}`,whole:true}
];
let blocks=[];
for(const {query,whole} of families){
 const response=await fetch(`https://fonts.googleapis.com/css2?${query}&display=swap`,{headers:{'User-Agent':userAgent}});
 if(!response.ok)throw new Error(`Font stylesheet unavailable: ${query}`);
 const css=await response.text();
 if(whole){
  // A text= subset comes back as one face without a subset comment.
  const faces=css.match(/@font-face\s*\{[^}]+\}/g)||[];
  if(!faces.length)throw new Error(`No font faces returned: ${query}`);
  blocks.push(...faces);
  continue;
 }
 const matches=[...css.matchAll(/\/\*\s*([^*]+?)\s*\*\/\s*(@font-face\s*\{[^}]+\})/gs)];
 if(!matches.length)throw new Error(`No font faces returned: ${query}`);
 blocks.push(...matches.filter(match=>['cyrillic','latin'].includes(match[1].trim())).map(match=>match[2]));
}
const urls=[...new Set(blocks.flatMap(block=>block.match(/https:\/\/fonts\.gstatic\.com\/[^)\s]+/g)||[]))];
let stylesheet=blocks.join('\n');
await Promise.all(urls.map(async(url,index)=>{
 const response=await fetch(url);if(!response.ok)throw new Error(`Font file unavailable: ${response.status}`);
 const name=`trace-web-${index}.woff2`;
 await writeFile(new URL(name,dir),Buffer.from(await response.arrayBuffer()));
 stylesheet=stylesheet.split(url).join(`./${name}`);
}));
await writeFile(new URL('trace-fonts.css',dir),stylesheet);
console.log(`Saved ${urls.length} WOFF2 font subsets.`);
