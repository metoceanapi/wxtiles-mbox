import { DataIntegral, IntegralPare, blurData, buildIntegralPare, loadDataIntegral } from './wxtools';

function ft_buildIntegralNaive(raw: Uint16Array): Uint32Array {
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
	let s = '';
	for (let x = 0; x < n * 2 + 1; x++) s += '...\t';
	console.log(s);
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

function ft_Uint16ArrayRandom() {
	let seed = 1;
	// const rnd = () => Math.floor(Math.abs(Math.sin(seed++)) * 32000 + 32000);
	const rnd = () => Math.floor(Math.random() * 32000);
	return new Uint16Array(258 * 258).map(rnd);
}

function ft_Uint16ArrayAscent() {
	return new Uint16Array(258 * 258).map((v, i) => (i % 258) + ~~(i / 258));
}

function ft_Uint16ArrayDescent() {
	return new Uint16Array(258 * 258).map((v, i) => 514 - ((i % 258) + ~~(i / 258)));
}

function ft_Uint32ArrayCompare(a: ArrayLike<number>, b: ArrayLike<number>) {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
	return 0;
}

function ft_blurNaive(im: Uint16Array, radius: number): Uint16Array {
	const raw = new Uint16Array(im);
	for (let y = 2; y < 256; y++) {
		for (let x = 2; x < 256; x++) {
			if (im[y * 258 + x] === 0) continue;
			let sum = 0;
			let count = 0;

			const rx = Math.min(radius, x - 1, 256 - x);
			const ry = Math.min(radius, y - 1, 256 - y);

			for (let iy = y - ry; iy <= y + ry; iy++) {
				for (let ix = x - rx; ix <= x + rx; ix++) {
					if (im[iy * 258 + ix] !== 0) {
						sum += im[iy * 258 + ix];
						count++;
					}
				}
			}

			raw[y * 258 + x] = sum / count;
		}
	}

	return raw;
}

function ft_buildDataIntegralAscent(): DataIntegral {
	return new DataIntegral(ft_Uint16ArrayAscent(), 0, 1, 1);
}

function ft_buildDataIntegralDescend(): DataIntegral {
	return new DataIntegral(ft_Uint16ArrayDescent(), 0, 1, 1);
}

function ft_buildDataIntegralRandom(): DataIntegral {
	return new DataIntegral(ft_Uint16ArrayRandom(), 0, 1, 1);
}

async function test_buildIntegralPare() {
	console.log('test_buildIntegralPare');
	const imU = ft_buildDataIntegralAscent(); //await loadDataIntegral('https://tilestest.metoceanapi.com/data/gfs.global/2023-04-26T18:00:00Z/cloud.cover/2023-05-06T15:00:00Z/3/0/3.png');

	const inpNaive = ft_buildIntegralNaive(imU.raw); // naive algo

	const rezult = ft_Uint32ArrayCompare(imU.integral.integral, inpNaive);
	console.log(rezult ? 'PASSED' : 'FAILED');

	!rezult && ft_printIm(imU.integral.integral, 4, 'integral');
	!rezult && ft_printIm(inpNaive, 4, 'naive');

	console.log('test_buildIntegralPare - end');
}

async function test_blurData() {
	console.log('test_blurData');

	// const imU = await loadDataIntegral('https://tilestest.metoceanapi.com/data/gfs.global/2023-04-26T18:00:00Z/cloud.cover/2023-05-06T15:00:00Z/3/0/3.png');
	// const imD = await loadDataIntegral('https://tilestest.metoceanapi.com/data/gfs.global/2023-04-26T18:00:00Z/cloud.cover/2023-05-06T15:00:00Z/3/0/3.png');

	const blurRadius = 4;
	const imU = ft_buildDataIntegralRandom();
	const blurNaive = ft_blurNaive(imU.raw, blurRadius); // blur image using naive algorithm
	blurData(imU, blurRadius); // blur image

	const rezult = ft_Uint32ArrayCompare(imU.raw, blurNaive);
	if (rezult) {
		const printN = 3;
		ft_printIm(imU.raw, printN, 'clear image U');
		ft_printIm(blurNaive, printN, 'naive BLUR');
		ft_printIm(imU.raw, printN, 'fast integral BLUR');
		const x = rezult % 258;
		const y = ~~(rezult / 258);
		console.log('test_blurData - FAILED: radius=', blurRadius, ', (x,y)=', x, y, ' diff=', imU.raw[y * 258 + x] - blurNaive[y * 258 + x]);
	} else {
		console.log('test_blurData - PASSED');
	}

	// blurData(imU, 0); // deblur image
	// ft_printIm(imU.raw, 4, 'deblur image');

	// blurData(imD, 1);
	// ft_printIm(imD.raw, 4, '');
}

async function test_blurDataBoundaries() {
	console.log('test_blurDataBoundaries');
	// not finished
	const blurRadius = 1;
	const imT = ft_buildDataIntegralRandom();
	const imB = ft_buildDataIntegralRandom();
	// copy last two rows imT to first two rows imB
	for (let i = 0; i < 258; i++) {
		imB.raw[258 * 0 + i] = imT.raw[258 * 256 + i];
		imB.raw[258 * 1 + i] = imT.raw[258 * 257 + i];
	}
	// print
	ft_printIm(imT.raw, 3, 'clear image T');
	ft_printIm(imB.raw, 3, 'clear image B');
	blurData(imT, blurRadius);
	blurData(imB, blurRadius);
	ft_printIm(imT.raw, 3, 'BLUR image T');
	ft_printIm(imB.raw, 3, 'BLUR image B');

	return;
} // test_blurDataBoundaries

export async function tests() {
	// TESTS are not usable in general. They are just for development and debugging
	await test_buildIntegralPare();
	await test_blurData();
	await test_blurDataBoundaries();
}
