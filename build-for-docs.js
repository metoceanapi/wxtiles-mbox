const esbuild = require('esbuild');
const express = require('express');

esbuild
	.build({
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
		outfile: 'docs/script/script.js',
		sourcemap: false,
		minify: true,
		// mangleProps: /.*/, // minify lib's namesbuildDOCS
	})
	.catch((e) => console.error(e.message));
