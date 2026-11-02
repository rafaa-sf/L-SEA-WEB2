// Cruza las clases estáticas de la plantilla con las definidas en style.css.
// Las clases dinámicas (`:class`) se ignoran a propósito: su nombre depende del
// estado y no puede validarse sin ejecutar el componente.
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.vue', 'utf8');
const css = readFileSync('src/style.css', 'utf8');
const template = app.slice(app.indexOf('<template>'));

const used = new Set();
for (const match of template.matchAll(/\sclass="([^"]*)"/g)) {
    for (const nombre of match[1].split(/\s+/)) {
        if (nombre) used.add(nombre);
    }
}

const defined = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
const missing = [...used].filter((nombre) => !defined.has(nombre)).sort();

if (missing.length) {
    console.log(`FALLO clases sin regla CSS (${missing.length}): ${missing.join(', ')}`);
    process.exit(1);
}

console.log(`Clases de plantilla con regla CSS: ${used.size} de ${used.size}. TODO OK`);
