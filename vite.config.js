import glsl from "vite-plugin-glsl";
import { defineConfig } from "vite";

const wasmContentTypePlugin = {
  name: "wasm-content-type-plugin",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      console.log("REQUEST!!!", Date.now(), req.url);
      if (req.url.endsWith(".wasm")) {
        res.setHeader("Content-Type", "application/wasm");
      }
      next();
    });
  },
};

export default defineConfig({
  plugins: [glsl(), wasmContentTypePlugin],
});
