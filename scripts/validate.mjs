import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const required = [
  'index.html', 'styles.css', 'app.js', 'sw.js', 'manifest.webmanifest', '.nojekyll',
  '404.html', 'README.md', 'docs/WEB_VERSION.md', 'data/cincinnati-alpha.json',
  'assets/icon.png', 'assets/splash-icon.png',
  'assets/characters/christian-moerlein.png',
  'assets/characters/samuel-hannaford.png',
  'assets/characters/levi-coffin.png',
  'assets/characters/christian/idle.png',
  'assets/characters/christian/talk.png',
  'assets/characters/christian/celebrate.png',
  '.github/workflows/deploy-pages.yml',
];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing: ${file}`);
}

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const data = JSON.parse(read('data/cincinnati-alpha.json'));
const manifest = JSON.parse(read('manifest.webmanifest'));

if (data.characters.length !== 3 || data.spots.length !== 6) {
  throw new Error('Unexpected Alpha content size');
}
if (!Array.isArray(data.relationNodes) || data.relationNodes.length < 1) {
  throw new Error('Relation nodes are missing');
}
if (manifest.start_url !== './' || manifest.scope !== './') {
  throw new Error('Manifest must support a GitHub Pages project path');
}

function uniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    if (!item.id || ids.has(item.id)) throw new Error(`Duplicate or empty ${label} ID: ${item.id}`);
    ids.add(item.id);
  }
  return ids;
}

const characterIds = uniqueIds(data.characters, 'character');
const spotIds = uniqueIds(data.spots, 'spot');
const nodeIds = uniqueIds(data.relationNodes, 'node');
uniqueIds(data.sources, 'source');

for (const spot of data.spots) {
  if (!Number.isFinite(spot.latitude) || !Number.isFinite(spot.longitude)) {
    throw new Error(`Invalid coordinates: ${spot.id}`);
  }
  for (const id of spot.characterIds) {
    if (!characterIds.has(id)) throw new Error(`Unknown character on spot ${spot.id}: ${id}`);
  }
}

for (const character of data.characters) {
  if (!character.voice || !character.wealth) throw new Error(`Missing profile: ${character.id}`);
  if (!fs.existsSync(path.join(root, 'assets/characters', `${character.id}.png`))) {
    throw new Error(`Missing portrait: ${character.id}`);
  }
  for (const id of character.spotIds) {
    if (!spotIds.has(id)) throw new Error(`Unknown spot on ${character.id}: ${id}`);
  }
  const total = character.wealth.composition.reduce((sum, item) => sum + item.percent, 0);
  if (total !== 100) throw new Error(`Wealth composition must total 100: ${character.id}`);
  if (character.wealth.battlePower < 0 || character.wealth.battlePower > 10000) {
    throw new Error(`Battle power out of range: ${character.id}`);
  }
  for (const question of character.questions) {
    for (const id of question.unlockNodeIds) {
      if (!nodeIds.has(id)) throw new Error(`Unknown node on ${question.id}: ${id}`);
    }
  }
}

for (const node of data.relationNodes) {
  for (const id of node.characterIds) {
    if (!characterIds.has(id)) throw new Error(`Unknown character on node ${node.id}: ${id}`);
  }
}

new vm.Script(read('app.js'));
new vm.Script(read('sw.js'));

const app = read('app.js');
for (const capability of ['navigator.geolocation', 'speechSynthesis', 'serviceWorker']) {
  if (!app.includes(capability)) throw new Error(`Missing browser capability: ${capability}`);
}

for (const explorationFeature of ['explore-map', 'select-signal', 'move-demo', 'signal-portrait']) {
  if (!app.includes(explorationFeature) && !read('styles.css').includes(explorationFeature)) {
    throw new Error(`Exploration map feature missing: ${explorationFeature}`);
  }
}

const blockedCopy = ['では' + 'ない', 'では' + 'なく'];
for (const file of ['index.html', 'styles.css', 'app.js', 'README.md', 'docs/WEB_VERSION.md']) {
  const source = read(file);
  for (const phrase of blockedCopy) {
    if (source.includes(phrase)) throw new Error(`Copy rule: ${file}`);
  }
}

for (const phrase of ['デート向け', 'デートの小ネタ', '$6.99']) {
  if (app.includes(phrase)) throw new Error(`Retired concept leaked into app: ${phrase}`);
}

for (const pose of ['idle.png', 'talk.png', 'celebrate.png']) {
  if (!app.includes(pose) || !workflowSafeAsset(`assets/characters/christian/${pose}`)) {
    throw new Error(`Encounter pose is not wired: ${pose}`);
  }
}

function workflowSafeAsset(file) {
  return fs.existsSync(path.join(root, file));
}

const workflow = read('.github/workflows/deploy-pages.yml');
for (const action of [
  'actions/checkout@v6',
  'actions/configure-pages@v6',
  'actions/upload-pages-artifact@v5.0.0',
  'actions/deploy-pages@v5',
]) {
  if (!workflow.includes(action)) throw new Error(`Workflow action missing: ${action}`);
}

console.log(
  `Ryoppy Web OK: ${data.characters.length} characters, ${data.spots.length} spots, ${data.relationNodes.length} nodes.`,
);
