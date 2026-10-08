import {readdirSync,readFileSync,statSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

// Presupuesto por imagen pensado para conexiones lentas (p. ej. datos móviles en Cuba).
const IMAGE_BUDGET_KB=300;
const PUBLIC_DIR=join(dirname(fileURLToPath(import.meta.url)),'..','public');

let passed=0;
const failures=[];
function assert(condition,message){if(condition)passed++;else failures.push(message);}

const sources=readdirSync(PUBLIC_DIR).filter(f=>/\.(html|css|js)$/.test(f));
const referenced=new Set();
for(const file of sources){
  const text=readFileSync(join(PUBLIC_DIR,file),'utf8');
  for(const [,path] of text.matchAll(/\/((?:assets|media)\/[\w.-]+)/g)) referenced.add(`${file} -> ${path}`);
}
for(const ref of referenced){
  const path=ref.split(' -> ')[1];
  assert(existsSync(join(PUBLIC_DIR,path)),`Recurso inexistente: ${ref}`);
}

for(const file of readdirSync(join(PUBLIC_DIR,'assets'))){
  const kb=Math.round(statSync(join(PUBLIC_DIR,'assets',file)).size/1024);
  assert(kb<=IMAGE_BUDGET_KB,`Imagen sobre el presupuesto de ${IMAGE_BUDGET_KB} KB: assets/${file} (${kb} KB)`);
}

if(failures.length){
  console.error(failures.join('\n'));
  console.error(`${failures.length} TESTS FAILED · ${passed} passed`);
  process.exit(1);
}
console.log(`${passed}/${passed} TESTS PASSED · recursos y presupuesto de imágenes`);
