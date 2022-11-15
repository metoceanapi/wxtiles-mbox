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
		outfile: 'docs/script/script.js',
		sourcemap: false,
		minify: true,
	})
	.catch((e) => console.error(e.message));
