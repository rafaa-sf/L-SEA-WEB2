<!-- src/components/Icon.vue — un solo juego de iconos para toda la interfaz -->
<script setup>
import { ICONS } from './icons.js';

const props = defineProps({
    name: { type: String, required: true },
    size: { type: [Number, String], default: 16 },
    stroke: { type: [Number, String], default: 1.6 }
});

const paths = ICONS[props.name] || [];
</script>

<template>
    <svg
        :width="size"
        :height="size"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        :stroke-width="stroke"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false">
        <path v-for="(d, i) in paths" :key="i" :d="d" />
    </svg>
</template>

<style scoped>
svg {
    display: block;
    flex: none;
}
</style>
