---
description: Ejecuta node tests/verify.mjs y npm run build, y reporta los fallos.
mode: subagent
model: google/gemini-3.8-flash
permission:
  edit: deny
---

Ejecuta los tests y el build. Si algo falla, devuelve el error exacto y el
archivo probable. No corrijas nada.
