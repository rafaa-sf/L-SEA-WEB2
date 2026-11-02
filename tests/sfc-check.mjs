// Compilación estática del SFC: detecta errores de plantilla y de script sin
// arrancar Vite (el sandbox bloquea los spawns de vite/oxide en Windows).
import { readFileSync } from 'node:fs';
import { parse, compileScript, compileTemplate, compileStyle } from 'vue/compiler-sfc';

const file = process.argv[2] || 'src/App.vue';
const source = readFileSync(file, 'utf8');
const { descriptor, errors } = parse(source, { filename: file });

let failures = 0;
for (const err of errors) {
    failures++;
    console.error(`parse: ${err.message}`);
}

const id = 'check';
const script = compileScript(descriptor, { id });
if (descriptor.template) {
    const result = compileTemplate({
        source: descriptor.template.content,
        filename: file,
        id,
        scoped: false,
        compilerOptions: { bindingMetadata: script.bindings }
    });
    for (const err of result.errors || []) {
        failures++;
        console.error(`template: ${typeof err === 'string' ? err : err.message}`);
    }
    for (const tip of result.tips || []) {
        console.log(`tip: ${typeof tip === 'string' ? tip : tip.message}`);
    }

    // Un identificador no declarado en <script setup> se compila como _ctx.<nombre>
    // y falla en tiempo de ejecución sin avisar. Aquí se convierte en error.
    const unresolved = new Set();
    for (const match of result.code.matchAll(/_ctx\.([A-Za-z_$][\w$]*)/g)) {
        unresolved.add(match[1]);
    }
    for (const name of unresolved) {
        failures++;
        console.error(`template: identificador no declarado en <script setup>: ${name}`);
    }

    for (const match of result.code.matchAll(/_resolveComponent\("([^"]+)"\)/g)) {
        failures++;
        console.error(`template: componente no importado: <${match[1]}> se resolvería en tiempo de ejecución`);
    }
}

for (const style of descriptor.styles) {
    const result = compileStyle({ source: style.content, filename: file, id, scoped: style.scoped });
    for (const err of result.errors || []) {
        failures++;
        console.error(`style: ${err.message}`);
    }
}

if (failures) {
    console.error(`${failures} error(es) en ${file}`);
    process.exit(1);
}
console.log(`${file}: OK`);
