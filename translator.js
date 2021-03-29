"use strict";

// === Begin configurations ===

// Yandex translator token from "https://translate.yandex.ru/" at "window.config = { ... SID: 'my_token', ... }"
const YT_TOKEN = "100027e1.96c84cf5.bf0d0873.47875647d22747";

// Source language
const langFrom = "ko"; // Korean

// Destination language
const langTo = "ru"; // English

// Directory of generated guides
const dataDir = "./out";

// Directory of translated guides
const outDir = "./out_translated";

// === End of configurations ===

const got = require("got");
const path = require("path");
const fs = require("fs");
const readdir = require("util").promisify(fs.readdir);

(function() {
	readFiles().then(async files => {
		const strings = readStrings();
		files.forEach(file => {
			if (!fs.existsSync(path.resolve(outDir, file.name)))
				getStrings(strings, file.content);
		});
		if (strings.size)
			console.log("strings parsed");
		translateStrings(strings).then(() => {
			console.log("strings translated");
			files.forEach(file => {
				const content = replaceStrings(strings, file.content);
				console.log(file.name, "translated");
				writeFile(file.name, content);
			});
		}).catch(e => {
			console.log(e);
		});
	});
}());

async function readFiles() {
	if (!fs.existsSync(path.resolve(outDir)))
		fs.mkdirSync(path.resolve(outDir), {
			"recursive": true
		});
	const files = new Set();
	(await readdir(path.resolve(dataDir))).forEach(name => {
		const content = fs.readFileSync(path.resolve(dataDir, name), "utf8");
		if (content)
			files.add({ name, content });
	});
	return files;
}

function writeFile(name, content) {
	if (!fs.existsSync(path.resolve(outDir)))
		fs.mkdirSync(path.resolve(outDir), {
			"recursive": true
		});
	fs.writeFileSync(path.resolve(outDir, name), content);
	console.log(name, "written");
}

function getStrings(strings, content) {
	for (const match of content.matchAll(RegExp("message: \"([^\"]+)\"", "g"))) {
		if (!strings.has(match[1]))
			strings.set(match[1], null);
	}
}

function translateStrings(strings) {
	const yandex = new YandexTranslator(YT_TOKEN);
	return new Promise((resolve, reject) => {
		let i = 0, k = 0;
		const timers = [];
		strings.forEach((value, key) => {
			if (strings.get(key)) {
				if (++k === strings.size)
					resolve(strings);
			} else {
				timers.push(setTimeout(() => {
					yandex.translate(key, { "from": langFrom, "to": langTo }).then(res => {
						console.log(">>", k, "/", strings.size, "<<", res.text);
						strings.set(key, res.text);
						writeStrings(strings);
						if (++k === strings.size)
							resolve(strings);
					}).catch(e => {
						timers.forEach(timer => clearTimeout(timer));
						reject(e);
					});
				}, ++i * 200));
			}
		});
	});
}

function replaceStrings(strings, content) {
	return content.replace(RegExp("(message:) \"([^\"]+)\"", "g"), (match, a, b) => `${a} "${strings.get(b)}"`);
}

function readStrings() {
	if (!fs.existsSync(path.resolve(`strings-${langFrom}-${langTo}.json`)))
		return new Map;
	return new Map(JSON.parse(fs.readFileSync(`strings-${langFrom}-${langTo}.json`)));
}

function writeStrings(strings) {
	fs.writeFileSync(path.resolve(`strings-${langFrom}-${langTo}.json`), JSON.stringify([...strings]));
}

class YandexTranslator {
	constructor(token = false) {
		this.headers = {
			"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.66 Safari/537.36}",
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
			"Accept-Encoding": "gzip, deflate, br",
			"Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
			"Cache-Control": "max-age=0",
			"Sec-Fetch-Dest": "document",
			"Sec-Fetch-Mode": "navigate",
			"Sec-Fetch-Site": "same-origin",
			"Sec-Fetch-User": "?1",
			"Upgrade-Insecure-Requests": "1"
		};

		this.token = token ? this.cryptToken(token) : this.getToken();
	}

	async translate(text, options) {
		const response = await got({
			"url": `https://translate.yandex.net/api/v1/tr.json/translate?id=${this.token}&srv=tr-text&lang=${options.from}-${options.to}&reason=auto&format=text&text=${encodeURI(text)}`,
			"headers": this.headers
		});
		return { "text": JSON.parse(response.body).text[0] };
	}

	async getToken() {
		const response = await got({ "url": "https://translate.yandex.ru/", "headers": this.headers });
		const match = response.body.match(/SID: '(.*?)',/i);
		if (match)
			return this.cryptToken(match[1]);
		return false;
	}

	cryptToken(token) {
		const bits = token.split(".");
		for (let i = 0; i < bits.length; i++)
			bits[i] = bits[i].split("").reverse().join("");
		return `${bits.join(".")}-0-0`;
	}
}
