const esbuild = require('esbuild');
const { externalGlobalPlugin } = require('esbuild-plugin-external-global');

const sharedConfig = {
	entryPoints: ['src/index.ts'],
	bundle: true,
	loader: {
		'.woff': 'base64',
		'.fs': 'text',
		'.vs': 'text',
	},
	plugins: [externalGlobalPlugin({ mapboxgl: 'window.mapboxgl' })],
	target: 'es6',
	minify: true,
};

// build for web
esbuild
	.build({
		...sharedConfig,
		globalName: 'wxtilesmbox',
		format: 'iife',
		outfile: 'dist/web/bundle.js',
	})
	.catch((e) => console.error(e.message));
// BUILD as ESModules
esbuild
	.build({
		...sharedConfig,
		format: 'esm',
		outfile: 'dist/es/bundle.js',
	})
	.catch((e) => console.error(e.message));
