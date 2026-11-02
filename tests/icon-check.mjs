// Cruza los nombres de iconos usados en la plantilla con el juego definido.
// Si falta uno, <Icon> no dibuja nada y el aviso desaparece sin error.
import { readFileSync } from 'node:fs';
import { ICONS } from '../src/components/icons.js';

const app = readFileSync('src/App.vue', 'utf8');
const template = app.slice(app.indexOf('<template>'));
// literal usage plus dynamic bindings such as :name="busy ? 'pause' : 'play'"
const literal = [...template.matchAll(/<Icon[^>]*name="([a-z0-9-]+)"/g)].map((m) => m[1]);
const dynamic = [...template.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]).filter((n) => n in ICONS);
const unique = [...new Set([...literal, ...dynamic])].sort();
const defined = Object.keys(ICONS);
const missing = unique.filter((name) => !defined.includes(name));
const unused = defined.filter((name) => !unique.includes(name));

console.log(`defined (${defined.length}): ${defined.join(', ')}`);
console.log(`used (${unique.length}): ${unique.join(', ')}`);
console.log(`unused: ${unused.join(', ') || 'none'}`);

if (missing.length) {
    console.error(`missing: ${missing.join(', ')}`);
    process.exit(1);
}
console.log('icon set OK');
