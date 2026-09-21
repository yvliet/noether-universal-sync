import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

const possibleSrcDirs = [
  'c:/Users/sultan haikal/Downloads/noether/src',
  path.resolve(__dirname, '../../src'),
  path.resolve(__dirname, '../src'),
];
const srcDir = possibleSrcDirs.find((d) => fs.existsSync(d)) || path.resolve(__dirname, '../../src');

const ignoreUrlQueriesPlugin = {
  name: 'ignore-url-queries',
  setup(build) {
    build.onResolve({ filter: /\?url$/ }, (args) => {
      return { path: args.path, external: true };
    });
  },
};

const buildOptions = {
  entryPoints: [path.join(__dirname, 'src/index.ts')],
  bundle: true,
  outfile: path.join(__dirname, 'dist/main.js'),
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  plugins: [ignoreUrlQueriesPlugin],
  external: [
    'react',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'react-dom',
    'react-dom/client',
    'zod',
    'zustand',
    'zustand/vanilla',
    'clsx',
    'tailwind-merge',
    '@hugeicons/*',
    '@hugeicons/react',
    '@hugeicons/core-free-icons',
    'noether',
    'noether/sdk',
    '@noether',
    '@noether/core',
    '@noether/sdk',
    'noether-sdk',
  ],
  alias: {
    '@': srcDir,
  },
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
};

async function run() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('[Watch] Watching for changes in src/...');
  } else {
    await esbuild.build(buildOptions);
    const stats = fs.statSync(path.join(__dirname, 'dist/main.js'));
    console.log(`[Build] Generated dist/main.js (${(stats.size / 1024).toFixed(1)} KB)`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
