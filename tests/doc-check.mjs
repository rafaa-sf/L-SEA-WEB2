// Checks that the documentation does not invent symbols or paths:
//   - every `symbol` in `src/App.vue` exists as a function or a constant,
//   - every `symbol` (`src/path`) pair names something the file actually declares,
//   - every src/... or tests/... path mentioned exists on disk.
import { readFileSync, existsSync } from 'node:fs';

const DOCS = ['README.md', 'features.md', 'docs/ARCHITECTURE.md', 'docs/FEATURES_PLATFORM.md', 'docs/FEATURES_RENDERER.md'];
const app = readFileSync('src/App.vue', 'utf8');

const symbolsOf = (text) => new Set([
    ...[...text.matchAll(/^(?:export )?(?:async )?function ([A-Za-z0-9_]+)/gm)].map((m) => m[1]),
    ...[...text.matchAll(/^(?:export )?const ([A-Za-z0-9_]+) =/gm)].map((m) => m[1]),
    ...[...text.matchAll(/^export \{ ([^}]+) \}/gm)].flatMap((m) => m[1].split(',').map((s) => s.trim()))
]);

const appSymbols = symbolsOf(app);
const problems = [];

for (const doc of DOCS) {
    const text = readFileSync(doc, 'utf8');

    // `symbol` in `src/App.vue`
    for (const match of text.matchAll(/`([A-Za-z][A-Za-z0-9_]+)` (?:en|in) `src\/App\.vue`/g)) {
        if (!appSymbols.has(match[1])) problems.push(`${doc}: \`${match[1]}\` is not declared in src/App.vue`);
    }

    // `symbol` (`src/.../file.js`)
    for (const match of text.matchAll(/`([A-Za-z][A-Za-z0-9_]+)` \(`((?:src|tests)\/[A-Za-z0-9_/.-]+)`\)/g)) {
        const [, symbol, path] = match;
        if (!existsSync(path)) {
            problems.push(`${doc}: the path ${path} does not exist`);
            continue;
        }
        if (!/\.(js|mjs|vue|css)$/.test(path)) continue;
        if (!symbolsOf(readFileSync(path, 'utf8')).has(symbol)) {
            problems.push(`${doc}: \`${symbol}\` is not declared in ${path}`);
        }
    }

    // paths
    for (const match of text.matchAll(/(?:src|tests)\/[A-Za-z0-9_/.-]+\.(?:json|mjs|js|css|vue)/g)) {
        const path = match[0];
        if (path.includes('*') || path.includes('<')) continue;
        if (!existsSync(path)) problems.push(`${doc}: the path ${path} does not exist`);
    }
}

if (problems.length) {
    for (const problem of problems) console.log(`FAIL ${problem}`);
    console.log(`\n${problems.length} FAILURE(S)`);
    process.exit(1);
}

console.log('Documentation references: OK');
