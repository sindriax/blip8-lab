import { defineConfig } from "vite";

// Relative asset paths, so the same build works mounted at /lab and at the root
// of a preview deployment.
export default defineConfig({
  base: "./",
});
