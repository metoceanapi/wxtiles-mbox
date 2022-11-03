const esbuild = require('esbuild');
const express = require('express');

const PORT = process.env.PORT || 3000;

esbuild
	.build({
		entryPoints: ['src_example/index.ts'],
		bundle: true,
		plugins: [],
		loader: {
			'.png': 'base64',
			'.woff': 'base64',
			'.fs': 'text',
			'.vs': 'text',
		},
		target: 'es2020',
		format: 'iife',
		outfile: 'public/wxtilembox/wxtilembox.js',
		sourcemap: true,
		minify: false,
		watch: {
			onRebuild(error, result) {
				if (error) {
					console.error('watch build failed:', error);
				} else {
					console.log('rebuilded', new Date());
				}
			},
		},
	})
	.then((result) => {
		const app = express();
		app.use(express.static('public'));

		const url = `http://localhost:${PORT}`;
		app.listen(PORT, () => {
			console.log(`Dev is running at ${url}`);
		});
	})
	.catch((e) => console.error(e.message));
