import { DataIntegral, IntegralPare, blurData, buildIntegralPare, loadDataIntegral } from './wxtools';

function buildIntegralNaive(raw: Uint16Array): Uint32Array {
	const integral = new Uint32Array(258 * 258);
	for (let y = 0; y < 258; y++) {
		for (let x = 0; x < 258; x++) {
			for (let iy = 0; iy <= y; iy++) {
				for (let ix = 0; ix <= x; ix++) {
					integral[y * 258 + x] += raw[iy * 258 + ix];
				}
			}
		}
	}
	return integral;
}

function ft_printIm(raw: ArrayLike<number>, n: number, comment: string) {
	console.log(comment);
	for (let y = 0; y < n; y++) {
		let s = '';
		for (let x = 0; x < n; x++) {
			s += raw[y * 258 + x] + '\t';
		}
		s += '...\t';
		for (let x = 258 - n; x < 258; x++) {
			s += raw[y * 258 + x] + '\t';
		}
		console.log(s);
	}
	console.log('...');
	for (let y = 258 - n; y < 258; y++) {
		let s = '';
		for (let x = 0; x < n; x++) {
			s += raw[y * 258 + x] + '\t';
		}
		s += '...\t';
		for (let x = 258 - n; x < 258; x++) {
			s += raw[y * 258 + x] + '\t';
		}
		console.log(s);
	}

	console.log('**********');
}

function Uint16ArrayRandom() {
	return new Uint16Array(258 * 258).map(() => Math.floor(Math.random() * 255));
}

function Uint32ArrayCompare(a: Uint32Array, b: Uint32Array) {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
}

async function test_buildIntegralPare() {
	const imU = await loadDataIntegral(
		'https://tilestest.metoceanapi.com/data/gfs.global/2023-04-25T00:00:00Z/air.temperature.at-2m/2023-05-05T00:00:00Z/3/3/6.png'
	);

	const raw = imU.raw; // random data

	const inp = imU.integral; // fast algo
	const inpNaive = buildIntegralNaive(raw); // naive algo

	console.log(Uint32ArrayCompare(inp.integral, inpNaive), ' - should be true');

	ft_printIm(inp.integral, 4, 'integral');
	ft_printIm(inpNaive, 4, 'naive');

	console.log(1);
}

test_buildIntegralPare();

async function test_blurData() {
	function ft_blurNaive(im: DataIntegral, radius: number) {
		const raw = new Uint16Array(im.raw);
		for (let y = 2; y < 257; y++) {
			for (let x = 2; x < 257; x++) {
				if (raw[y * 258 + x] === 0) continue;
				let sum = 0;
				let count = 0;
				for (let iy = y - radius; iy <= y + radius; iy++) {
					for (let ix = x - radius; ix <= x + radius; ix++) {
						if (iy >= 0 && iy < 258 && ix >= 0 && ix < 258) {
							sum += raw[iy * 258 + ix];
							count++;
						}
					}
				}
				im.raw[y * 258 + x] = sum / count;
			}
		}
	}

	const imU = await loadDataIntegral(
		'https://tilestest.metoceanapi.com/data/gfs.global/2023-04-25T00:00:00Z/air.temperature.at-2m/2023-05-05T00:00:00Z/3/3/6.png'
	);
	const imD = await loadDataIntegral(
		'https://tilestest.metoceanapi.com/data/gfs.global/2023-04-25T00:00:00Z/air.temperature.at-2m/2023-05-05T00:00:00Z/3/3/7.png'
	);

	ft_printIm(imU.raw, 4, 'clear image'); // clear image
	ft_blurNaive(imU, 1); // blur image using naive algorithm
	ft_printIm(imU.raw, 4, 'naive algorithm');
	blurData(imU, 1); // blur image
	ft_printIm(imU.raw, 4, 'fast algorithm');

	blurData(imD, 1);
	ft_printIm(imD.raw, 4, '');
}

// test_blurData();

export function tests() {}
