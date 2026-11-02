// Comprueba tres reglas de la directiva del proyecto:
//   1. sin emoji pictográficos en la UI ni en la documentación,
//   2. sin restos de español en la UI (la app es en inglés),
//   3. un único recuento de sitios en la documentación (25).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = process.cwd();
const DOCS = ['README.md', 'features.md', 'docs/ARCHITECTURE.md', 'docs/FEATURES_PLATFORM.md', 'docs/FEATURES_RENDERER.md'];
const UI = ['src/App.vue', 'src/components/Icon.vue', 'index.html'];
const IGNORAR = /node_modules|\\dist\\|\.git|public[\\/]data|graphify-out|\.vercel|\.opencode|\.agents|src-tauri[\\/]target/;

const emoji = /\p{Extended_Pictographic}/u;
const espanol = [
    'sitio', 'pendiente', 'cargando', 'evaluar', 'comparar', 'altura', 'sonda', 'reiniciar', 'buscar',
    'cerrar', 'elige', 'selecciona', 'ningun', 'ninguno', 'elevacion', 'elevación', 'sombras', 'niebla',
    'pendientes', 'inclinacion', 'inclinación', 'iluminacion', 'iluminación', 'aterrizaje', 'aterrizar',
    'ningun sitio', 'sin datos', 'resultado', 'resultados', 'sitios', 'pulsa', 'haz clic'
];

const problemas = [];

function archivos(dir) {
    const salida = [];
    for (const nombre of readdirSync(dir)) {
        const ruta = join(dir, nombre);
        if (IGNORAR.test(ruta)) continue;
        const info = statSync(ruta);
        if (info.isDirectory()) salida.push(...archivos(ruta));
        else if (/\.(md|vue|js|mjs|css|html)$/.test(nombre)) salida.push(ruta);
    }
    return salida;
}

for (const ruta of archivos(RAIZ)) {
    const texto = readFileSync(ruta, 'utf8');
    const rel = relative(RAIZ, ruta).replace(/\\/g, '/');
    if (emoji.test(texto)) problemas.push(`${rel}: contiene un emoji pictografico`);
}

function textoVisible(ruta, fuente) {
    if (!ruta.endsWith('.vue')) return fuente;
    const plantilla = fuente.slice(fuente.indexOf('<template>'));
    const sinComentarios = plantilla.replace(/<!--[\s\S]*?-->/g, ' ');
    const sinEtiquetas = sinComentarios.replace(/<[^>]*>/g, ' ').replace(/\{\{[\s\S]*?\}\}/g, ' ');
    const cadenas = [...fuente.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)]
        .map((m) => m[2].replace(/\$\{[^}]*\}/g, ' '))
        .join(' ');
    return `${sinEtiquetas} ${cadenas}`;
}

for (const ruta of UI) {
    const texto = textoVisible(ruta, readFileSync(ruta, 'utf8')).toLowerCase();
    for (const palabra of espanol) {
        const patron = new RegExp(`(?<![a-z])${palabra}(?![a-z])`);
        if (patron.test(texto)) problemas.push(`${ruta}: texto visible en espanol "${palabra}"`);
    }
}

for (const ruta of DOCS) {
    const texto = readFileSync(ruta, 'utf8');
    for (const coincidencia of texto.matchAll(/(\d{1,3})\s+(?:sites|candidate sites|POI)/g)) {
        if (coincidencia[1] !== '25') problemas.push(`${ruta}: recuento de sitios ${coincidencia[1]} (debe ser 25)`);
    }
    if (!texto.includes('25')) problemas.push(`${ruta}: no menciona el recuento unico de 25 sitios`);
}

if (problemas.length) {
    for (const problema of problemas) console.log(`FALLO ${problema}`);
    console.log(`\n${problemas.length} FALLO(S)`);
    process.exit(1);
}

console.log('Reglas de idioma y recuento: TODO OK');
