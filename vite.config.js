import { defineConfig } from 'vite';

function removeCSPInDev() {
    return {
        name: 'remove-csp-in-dev',
        apply: 'serve',   // only runs during dev server, not build
        transformIndexHtml(html) {
            return html.replace(/<meta[^>]*Content-Security-Policy[^>]*>\s*/i, '');
        }
    };
}

export default defineConfig({
    plugins: [removeCSPInDev()],
    publicDir: 'public',
    build: {
        outDir: 'dist',
        emptyOutDir: true
    }
});
