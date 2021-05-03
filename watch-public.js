const esbuild = require('esbuild');
const sassPlugin = require('esbuild-plugin-sass');
const open = require('open');
const express = require('express');
const cors = require('cors');

let watchResponse;
const disableHotReload = process.env.DISABLE_HOT_RELOAD === 'true';

esbuild
	.build({
		entryPoints: ['src/index.ts'],
		bundle: true,
		plugins: [sassPlugin()],
		loader: {
			'.woff': 'file',
			'.fs': 'text',
			'.vs': 'text',
		},
		target: 'es6',
		format: 'iife',
		outfile: 'public/wxtilembox/wxtilembox.js',
		globalName: 'wxtilembox',
		sourcemap: true,
		minify: false,
		watch: {
			onRebuild(error, result) {
				if (error) {
					console.error('watch build failed:', error);
				} else {
					console.log('rebuilded', new Date());
					!disableHotReload && watchResponse && watchResponse.write('data: refresh\n\n');
				}
			},
		},
	})
	.then((result) => {
		const app = express();
		app.use(cors());
		app.use(express.static('public'));

		const PORT = 3002;

		app.get('/watch', function (req, res) {
			res.writeHead(200, {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			});
		});

		const url = `http://localhost:${PORT}`;
		app.listen(PORT, () => {
			console.log(`Dev is running at ${url}`);
		});
		open(url);
	})
	.catch((e) => console.error(e.message));
