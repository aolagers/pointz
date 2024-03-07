import glsl from "vite-plugin-glsl";
import { defineConfig } from "vite";
import { createReadStream } from "node:fs";

const wasmInterceptor = {
    name: "wasm-interceptor-plugin",
    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            if (req.url.endsWith("/laz-perf.wasm")) {
                console.log(">>> WASM", req.url);
                res.setHeader("Content-Type", "application/wasm");
                createReadStream("./node_modules/copc/node_modules/laz-perf/lib/laz-perf.wasm").pipe(res);
            } else {
                next();
            }
        });
    },
};

export default defineConfig({
    plugins: [glsl(), wasmInterceptor],
    base: "",
    test: {
        includeSource: ["src/**/*.ts"],
    },
});
