import { defineConfig } from "vite";
import fs from "fs";
import path from "path";

const removeCSPInDev = {
    name: 'remove-csp-in-dev',
    apply: 'serve',   // only runs during dev server, not build
    transformIndexHtml(html) {
        return html.replace(/<meta[^>]*Content-Security-Policy[^>]*>\s*/i, '');
    }
};

const serveJsonDir = {
    name: 'serve-json-dir',
    apply: 'serve',
    configureServer(server) {
        server.middlewares.use('/json', (req, res, next) => {
            const filePath = path.join(process.cwd(), 'json', req.url);
            fs.readFile(filePath, (err, data) => {
                if (err) return next();
                res.end(data);
            });
        });
    }
};

export default defineConfig({
    plugins: [removeCSPInDev, serveJsonDir],
    publicDir: 'public',
    server: {
        proxy: {
            '/data': {
                target: 'https://undermine.exchange',
                changeOrigin: true
            }
        }
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        emptyOutDir: true
    }
});
