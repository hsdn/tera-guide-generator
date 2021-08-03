"use strict";

// === Begin configurations ===

// Source language
const langFrom = "ko"; // Korean

// Destination language
const langTo = "en"; // English

// Directory of generated guides
const dataDir = "./out";

// Directory of translated guides
const outDir = "./out_translated";

// === End of configurations ===

const request = require("node-fetch");
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
	return new Promise((resolve, reject) => {
		let i = 0, k = 0;
		const timers = [];
		strings.forEach((value, key) => {
			if (strings.get(key)) {
				if (++k === strings.size)
					resolve(strings);
			} else {
				timers.push(setTimeout(() => {
					googleTranslate(key, langTo, langFrom).then(res => {
						console.log(">>", k, "/", strings.size, "<<", res);
						strings.set(key, res);
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

async function googleTranslate(text, translateTo, translateFrom) {
	const url = `${"https://translate.google.com/translate_a/single"
		+ "?client=at&dt=t&dt=ld&dt=qca&dt=rm&dt=bd&dj=1&hl="}${translateTo}&ie=UTF-8`
		+ "&oe=UTF-8&inputm=2&otf=2&iid=1dd3b944-fa62-4b55-b330-74909a99969e";
	const params = new URLSearchParams();
	params.append("sl", translateFrom);
	params.append("tl", translateTo);
	params.append("q", text.replace(/\|/g, "//"));
	const response = await request(url, {
		"method": "post",
		"body": params,
		"headers": {
			"Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
			"User-Agent": "AndroidTranslate/5.3.0.RC02.130475354-53000263 5.1 phone TRANSLATE_OPM5_TEST_1"
		}
	});
	const body = await response.text();
	return new Promise((resolve, reject) => {
		try {
			const jsonBody = JSON.parse(body);
			resolve(jsonBody.sentences[0].trans.replace(/\/\//g, "|"));
		} catch (e) {
			reject("Translate Error");
		}
	});
}
