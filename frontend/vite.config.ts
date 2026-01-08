// vite.config.ts

import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { defineConfig, type Plugin } from "vite";

function executorSchemasPlugin(): Plugin {
  const VIRTUAL_ID = "virtual:executor-schemas";
  const RESOLVED_VIRTUAL_ID = "\0" + VIRTUAL_ID;

  return {
    name: "executor-schemas-plugin",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID; // keep it virtual
      return null;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return null;

      const schemasDir = path.resolve(__dirname, "../shared/schemas");
      const files = fs.existsSync(schemasDir)
        ? fs.readdirSync(schemasDir).filter((f) => f.endsWith(".json"))
        : [];

      const imports: string[] = [];
      const entries: string[] = [];

      files.forEach((file, i) => {
        const varName = `__schema_${i}`;
        const importPath = `shared/schemas/${file}`; // uses your alias
        const key = file.replace(/\.json$/, "").toUpperCase(); // claude_code -> CLAUDE_CODE
        imports.push(`import ${varName} from "${importPath}";`);
        entries.push(`  "${key}": ${varName}`);
      });

      // IMPORTANT: pure JS (no TS types), and quote keys.
      const code = `
${imports.join("\n")}

export const schemas = {
${entries.join(",\n")}
};

export default schemas;
`;
      return code;
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      // Use automatic JSX runtime for smaller bundle
      jsxRuntime: "automatic",
    }),
    executorSchemasPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      shared: path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    port: Number.parseInt(process.env.FRONTEND_PORT || "3000"),
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.BACKEND_PORT || "3001"}`,
        changeOrigin: true,
        ws: true,
      },
    },
    fs: {
      allow: [path.resolve(__dirname, "."), path.resolve(__dirname, "..")],
    },
    open: process.env.VITE_OPEN === "true",
  },
  optimizeDeps: {
    exclude: ["wa-sqlite"],
    // Pre-bundle these for faster dev startup
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "zustand",
      "clsx",
      "tailwind-merge",
    ],
  },
  // CSS optimization
  css: {
    devSourcemap: true,
  },
  // Esbuild options for faster builds
  esbuild: {
    // TEMPORARILY DISABLED for debugging - keep console in production
    // drop: mode === "production" ? ["console", "debugger"] : [],
    // Target modern browsers for smaller output
    target: "es2020",
  },
  build: {
    // Target modern browsers
    target: "es2020",
    // Generate sourcemaps for debugging (can disable in production for smaller builds)
    sourcemap: mode === "development",
    // Minify with esbuild (faster than terser)
    minify: "esbuild",
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // CSS code splitting
    cssCodeSplit: true,
    // Rollup options
    rollupOptions: {
      output: {
        // Better chunk naming for caching
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        manualChunks: {
          // React core - loaded first, cached longest
          "vendor-react": ["react", "react-dom"],
          // Router - needed for all navigation
          "vendor-router": ["react-router-dom"],
          // Core UI utilities - used across the app
          "vendor-ui-core": [
            "@radix-ui/react-slot",
            "clsx",
            "tailwind-merge",
            "class-variance-authority",
          ],
          // Radix UI components - loaded on demand
          "vendor-radix": [
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-select",
            "@radix-ui/react-switch",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-accordion",
          ],
          // Icons and animations - can be lazy loaded
          "vendor-icons": ["lucide-react"],
          "vendor-animation": ["framer-motion"],
          // State management
          "vendor-state": ["zustand", "@tanstack/react-query"],
          // TanStack ecosystem
          "vendor-tanstack-extra": [
            "@tanstack/react-form",
            "@tanstack/react-db",
            "@tanstack/electric-db-collection",
          ],
          // i18n - needed early but cached well
          "vendor-i18n": [
            "i18next",
            "i18next-browser-languagedetector",
            "react-i18next",
          ],
          // Heavy components - lazy loaded
          "vendor-codemirror": [
            "@codemirror/lang-json",
            "@codemirror/language",
            "@codemirror/lint",
            "@codemirror/view",
            "@uiw/react-codemirror",
          ],
          "vendor-lexical": ["lexical"],
          "vendor-diff": ["@git-diff-view/react", "@git-diff-view/file"],
          "vendor-virtuoso": ["@virtuoso.dev/message-list"],
          "vendor-rjsf": ["@rjsf/core", "@rjsf/utils", "@rjsf/validator-ajv8"],
          // Auth - only loaded when Clerk is enabled
          "vendor-clerk": ["@clerk/clerk-react"],
          // DnD - only needed for kanban
          "vendor-dnd": ["@dnd-kit/core", "@dnd-kit/utilities"],
          // Modals
          "vendor-modals": ["@ebay/nice-modal-react"],
          // Utilities
          "vendor-utils": ["lodash", "rfc6902"],
        },
      },
    },
  },
}));
