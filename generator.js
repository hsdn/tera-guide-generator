"use strict";

// === Begin configurations ===

// Directory of parsed datacenter files
const dataDir = "../tera-datacenter-master/out/EUR";

// Directory of generated guides
const outDir = "./out";

// Header template
const contentHeader = `
module.exports = (dispatch, handlers, guide, lang) => {
	guide.type = SP;

	return {
`;

// Footer template
const contentFooter = `
	};
};`;

// === End of configurations ===


const path = require("path");
const fs = require("fs");
const readdir = require("util").promisify(fs.readdir);

(function() {
	readDungeonData()
		.then(dungeonData => readSkillData(dungeonData))
		.then(skillData => writeOutData(skillData));
}());

async function readDungeonData() {
	const dungeonList = new Map();
	const stringList = new Map();
	const strSheetDungeonData = require(path.resolve(dataDir, "StrSheet_Dungeon", "StrSheet_Dungeon-0.json"));
	strSheetDungeonData.String.forEach(dungeon =>
		stringList.set(dungeon.id, dungeon.string)
	);
	(await readdir(path.resolve(dataDir, "Dungeon"))).forEach(file => {
		const dungeonData = require(path.resolve(dataDir, "Dungeon", file));
		if (!dungeonData.continentId || !dungeonData.ClearCondition) return;
		const continentId = dungeonData.continentId;
		const huntingZoneId = dungeonData.ClearCondition[0]["huntingZoneId"];
		if (continentId && huntingZoneId && !dungeonList.has(huntingZoneId))
			dungeonList.set(huntingZoneId, {
				"id": continentId,
				"string": stringList.get(continentId) || continentId
			});
		console.log(file, "parsed");
	});
	return dungeonList;
}

async function readSkillData(dungeonData) {
	const skillData = {};
	(await readdir(path.resolve(dataDir, "SkillData"))).forEach(file => {
		if (!file.endsWith(".json")) return;
		const fileData = require(path.resolve(dataDir, "SkillData", file));
		if (!fileData.huntingZoneId || !dungeonData.has(fileData.huntingZoneId) || !fileData.Skill) return;
		if (!skillData[fileData.huntingZoneId])
			skillData[fileData.huntingZoneId] = {
				"dungeon": dungeonData.get(fileData.huntingZoneId),
				"skills": []
			};
		fileData.Skill.forEach(skill => {
			skillData[fileData.huntingZoneId]["skills"].push({
				"templateId": skill.templateId,
				"id": skill.id,
				"name": skill.name
			});
		});
		delete require.cache[require.resolve(path.resolve(dataDir, "SkillData", file))];
		console.log(file, "parsed");
	});
	return skillData;
}

function writeOutData(skillData) {
	if (!fs.existsSync(path.resolve(outDir)))
		fs.mkdirSync(path.resolve(outDir), {
			"recursive": true
		});
	Object.keys(skillData).forEach(huntingZoneId => {
		const dungeon = skillData[huntingZoneId]["dungeon"];
		const filePath = path.resolve(outDir, `${dungeon.id}.js`);
		const contentTitle = `// ${dungeon.string}\n\n`;
		const content = [];
		skillData[huntingZoneId]["skills"].forEach(skill =>
			content.push(`\t\t"s-${huntingZoneId}-${skill.templateId}-${skill.id}-0": [{ type: "text", sub_type: "message", message: "${skill.name.replace(/_/g, " | ")}" }]`)
		);
		if (!fs.existsSync(filePath)) {
			fs.writeFileSync(filePath, contentTitle + contentHeader + content.join(",\n") + contentFooter);
			console.log(`${dungeon.id}.js`, "written");
		}
	});
}