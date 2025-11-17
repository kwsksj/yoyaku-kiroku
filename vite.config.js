import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

/**
 * Vite plugin to process the HTML template and inject frontend scripts
 */
function htmlTemplatePlugin() {
  return {
    name: 'html-template-plugin',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // Read the main HTML template
        const templatePath = resolve(__dirname, 'src/templates/10_WebApp.html');
        let template = fs.readFileSync(templatePath, 'utf-8');

        // Get all frontend JS files in order
        const frontendDir = resolve(__dirname, 'src/frontend');
        const frontendFiles = fs
          .readdirSync(frontendDir)
          .filter((f) => f.endsWith('.js'))
          .sort();

        // Create script tags for development
        const scriptTags = frontendFiles
          .map((file) => {
            return `<script type="module" src="/src/frontend/${file}"></script>`;
          })
          .join('\n    ');

        // Inject scripts before closing body tag
        template = template.replace(
          '</body>',
          `
    <!-- Development Scripts -->
    <script type="module" src="/test/mocks/setup-dev.js"></script>
    ${scriptTags}
  </body>`
        );

        return template;
      },
    },
  };
}

export default defineConfig({
  plugins: [htmlTemplatePlugin()],

  root: '.',

  publicDir: 'public',

  server: {
    port: 3000,
    open: true,
    strictPort: false,
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@frontend': resolve(__dirname, './src/frontend'),
      '@backend': resolve(__dirname, './src/backend'),
      '@shared': resolve(__dirname, './src/shared'),
      '@test': resolve(__dirname, './test'),
      '@types': resolve(__dirname, './types'),
    },
  },

  // Vitest configuration
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./test/setup.js'],
    include: ['test/unit/**/*.{test,spec}.{js,mjs,cjs}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '*.config.js',
        'build-output/',
        'types/',
        'tools/',
      ],
    },
  },

  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
});
