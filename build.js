const esbuild = require('esbuild');
const { externalGlobalPlugin } = require('esbuild-plugin-external-global');
const { glsl } = require('esbuild-plugin-glsl');

const sharedConfig = {
	entryPoints: ['src/index.ts'],
	bundle: true,
	loader: {
		'.woff': 'base64',
		'.vert': 'text', // shanged to use plugin glsl
		'.frag': 'text',
	},
	plugins: [externalGlobalPlugin({ mapboxgl: 'window.mapboxgl' }), glsl({ minify: true })],
	// target: 'es6',
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
