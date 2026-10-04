import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import yaml from "@rollup/plugin-yaml";

// Relative asset paths, so the build works at any path GitHub Pages serves it from.
export default defineConfig({
  base: "./",
  plugins: [svelte(), yaml()],
  worker: { format: "es" },   // MapLibre runs its worker as a module
});
