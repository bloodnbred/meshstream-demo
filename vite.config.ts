import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Two build targets:
 *   `vite build`            -> dist/            static multi-asset bundle (serve with any static server)
 *   `vite build --mode single` -> dist-single/  one self-contained index.html (open with file://)
 *
 * `base: "./"` keeps both builds relative-path safe, which the single-file build needs.
 */
export default defineConfig(({ mode }) => {
  const single = mode === "single";

  return {
    base: "./",
    plugins: [
      react(),
      tailwindcss(),
      ...(single ? [viteSingleFile({ removeViteModuleLoader: true })] : []),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 5173,
      host: "127.0.0.1",
    },
    build: {
      outDir: single ? "dist-single" : "dist",
      target: "es2022",
      sourcemap: false,
      chunkSizeWarningLimit: 1400,
    },
  };
});
