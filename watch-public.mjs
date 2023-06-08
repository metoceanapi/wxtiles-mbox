// import { type BuildOptions, context } from 'esbuild';
import * as esbuild from 'esbuild';
import http from 'node:http';

const PORT = +process.env.PORT || 3003;

const buildOptions = {
	entryPoints: ['src_example/index.ts'],
	bundle: true,
	plugins: [],
	loader: {
		'.png': 'base64',
		'.woff': 'base64',
		'.frag': 'text',
		'.vert': 'text',
	},
	format: 'iife',
	outfile: 'public/wxtilembox/wxtilembox.js',
	sourcemap: true,
	minify: false,
};

let ctx = await esbuild.context(buildOptions);
await ctx.watch();
console.log('watching...');

const { host, port } = await ctx.serve({ host: 'localhost', port: PORT + 1000, servedir: 'public' });
console.log(`Dev is running at ${host}:${PORT}`);

//*
// Then start a proxy server on PORT
// https://esbuild.github.io/api/#serve-proxy
http
	.createServer((req, res) => {
		const options = {
			hostname: host,
			port: port,
			path: req.url,
			method: req.method,
			headers: req.headers,
		};

		/* 	if (req.url.startsWith('/data/masks')) {
			options.port = 9191; // all from local 'simple NGINX'
		} else  */ if (req.url.startsWith('/data')) {
			// options.port = undefined;
			// options.hostname = 'hihi2.metoceanapi.com';
			// options.path = 'https://' + options.hostname + req.url;

			options.port = 9191; // local 'simple NGINX'

			// options.port = 8080; // wxtiles-http-server
		}

		try {
			// Forward each incoming request to esbuild
			const proxyReq = http.request(options, (proxyRes) => {
				res.writeHead(proxyRes.statusCode, proxyRes.headers);
				proxyRes.pipe(res, { end: true });
			});

			// Forward the body of the request to esbuild
			req.pipe(proxyReq, { end: true });
		} catch (e) {
			console.error(e);
		}
	})
	.listen(PORT);
//*/
