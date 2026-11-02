// ==============================================================================
// PATH: src/core/pois.js
// CATÁLOGO ÚNICO DE PUNTOS DE INTERÉS (25 sitios): alimenta a la vez el selector
// de la barra superior y las etiquetas 3D. Un solo origen, un solo recuento.
// Coordenadas de catálogos NASA/IAU/USGS, polo sur lunar (80°S–90°S).
// ==============================================================================

export const POIS = Object.freeze([
    // Cráteres con piso en sombra permanente (PSR)
    { codigo: 'P-01', nombre: 'Shackleton Crater', lat: -89.9, lon: 129.8, tipo: 'psr', desc: 'South pole; PSR floor with an illuminated rim' },
    { codigo: 'P-02', nombre: 'Amundsen Crater', lat: -84.5, lon: 82.8, tipo: 'psr', desc: 'Large crater; floor in permanent shadow' },
    { codigo: 'P-03', nombre: 'Scott Crater', lat: -82.1, lon: 53.2, tipo: 'psr', desc: 'Northern edge of the surveyed basin' },
    { codigo: 'P-04', nombre: 'Faustini Crater', lat: -87.3, lon: 77.0, tipo: 'psr', desc: 'PSR candidate close to the pole' },
    { codigo: 'P-05', nombre: 'Shoemaker Crater', lat: -88.1, lon: 44.9, tipo: 'psr', desc: 'PSR floor named after Gene Shoemaker' },
    { codigo: 'P-06', nombre: 'Haworth Crater', lat: -87.5, lon: -5.0, tipo: 'psr', desc: 'PSR candidate on the western rim' },
    { codigo: 'P-07', nombre: 'Nobile Crater', lat: -84.2, lon: -28.5, tipo: 'psr', desc: 'VIPER / CLPS target region' },
    { codigo: 'P-08', nombre: 'Cabeus Crater', lat: -84.9, lon: -35.5, tipo: 'psr', desc: 'LCROSS impact site; water ice confirmed' },
    { codigo: 'P-09', nombre: 'Wiechert Crater', lat: -85.5, lon: -15.0, tipo: 'psr', desc: 'Degraded crater with a flat floor' },
    { codigo: 'P-10', nombre: 'Sverdrup Crater', lat: -88.5, lon: -110.0, tipo: 'psr', desc: 'Near-polar crater with a PSR floor' },
    { codigo: 'P-11', nombre: 'de Gerlache Crater', lat: -88.3, lon: -85.0, tipo: 'psr', desc: 'Rim connects to the Shackleton massif' },
    { codigo: 'P-12', nombre: 'Idel\u2019son Crater', lat: -81.5, lon: -110.0, tipo: 'psr', desc: 'Outer edge of the 80°S catalogue' },

    // Macizos y picos
    { codigo: 'P-13', nombre: 'Malapert Mountain', lat: -86.0, lon: 0.1, tipo: 'mount', desc: 'Near-permanently illuminated peak' },
    { codigo: 'P-14', nombre: 'Leibnitz Beta', lat: -83.5, lon: 30.0, tipo: 'mount', desc: 'High ground of the Leibniz massif' },
    { codigo: 'P-15', nombre: 'Leibnitz Gamma', lat: -82.0, lon: 15.0, tipo: 'mount', desc: 'Leibniz massif; access to the pole' },
    { codigo: 'P-16', nombre: 'Mons Malapert', lat: -85.8, lon: 355.0, tipo: 'mount', desc: 'Alternate IAU designation of Malapert' },

    // Sitios CLPS / Artemis
    { codigo: 'P-17', nombre: 'Connecting Ridge', lat: -89.8, lon: 45.0, tipo: 'clps', desc: 'Shackleton–de Gerlache ridge; Artemis target' },
    { codigo: 'P-18', nombre: 'Shackleton Rim A', lat: -89.7, lon: 0.0, tipo: 'clps', desc: 'Rim point at 0° longitude' },
    { codigo: 'P-19', nombre: 'Shackleton Rim B', lat: -89.7, lon: 90.0, tipo: 'clps', desc: 'Rim point at 90° longitude' },
    { codigo: 'P-20', nombre: 'Shackleton Rim C', lat: -89.7, lon: 180.0, tipo: 'clps', desc: 'Rim point at 180° longitude' },
    { codigo: 'P-21', nombre: 'Shackleton Rim D', lat: -89.7, lon: 270.0, tipo: 'clps', desc: 'Rim point at 270° longitude' },
    { codigo: 'P-22', nombre: 'Nobile Rim', lat: -84.0, lon: -30.0, tipo: 'clps', desc: 'VIPER / CLPS candidate; PSR access' },
    { codigo: 'P-23', nombre: 'Cabeus Rim', lat: -84.5, lon: -35.0, tipo: 'clps', desc: 'Cabeus rim near the ice confirmation' },

    // Referencia geográfica
    { codigo: 'P-24', nombre: 'South Pole', lat: -89.99, lon: 0.0, tipo: 'ref', desc: 'Exact geographic pole (90°S)' },
    { codigo: 'P-25', nombre: 'Amundsen Rim', lat: -84.0, lon: 85.0, tipo: 'ref', desc: 'Northern rim of Amundsen' }
]);

export const POI_TIPOS = Object.freeze([
    { id: 'todos', etiqueta: 'All' },
    { id: 'psr', etiqueta: 'PSR craters' },
    { id: 'mount', etiqueta: 'Massifs' },
    { id: 'clps', etiqueta: 'CLPS / Artemis' },
    { id: 'ref', etiqueta: 'Reference' }
]);
