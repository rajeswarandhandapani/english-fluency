// Keeps sw.js FILES in sync with all static app assets on disk. Usage: node scripts/build-sw.cjs
const fs = require('fs');
const path = require('path');

const START_MARK = '// PWA-KIT:FILES-START';
const END_MARK = '// PWA-KIT:FILES-END';

function listRel(root, dir, extRe) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full)
    .filter(f => extRe.test(f))
    .sort((a, b) => a.localeCompare(b))
    .map(f => `./${dir}/${f}`);
}

function collectFiles(root) {
  const files = ['./', './index.html'];
  for (const top of ['styles.css', 'manifest.webmanifest']) {
    if (fs.existsSync(path.join(root, top))) files.push(`./${top}`);
  }
  files.push(...listRel(root, 'icons', /\.png$/i));
  files.push(...listRel(root, 'lib', /\.(css|js)$/i));
  files.push(...listRel(root, 'js', /\.js$/i));
  return files;
}

function buildSw(root = path.join(__dirname, '..')) {
  const swPath = path.join(root, 'sw.js');
  const current = fs.readFileSync(swPath, 'utf8');
  const startIdx = current.indexOf(START_MARK);
  const endIdx = current.indexOf(END_MARK);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`sw.js must contain ${START_MARK} and ${END_MARK} markers.`);
  }
  const files = collectFiles(root);
  const body = `${START_MARK}\nconst FILES = [\n${files.map(f => `  '${f}',`).join('\n')}\n];\n${END_MARK}`;
  const next = current.slice(0, startIdx) + body + current.slice(endIdx + END_MARK.length);
  const changed = next !== current;
  if (changed) fs.writeFileSync(swPath, next);
  return { files, changed };
}

if (require.main === module) {
  const { files, changed } = buildSw();
  console.log(`${changed ? 'Updated' : 'Verified'} sw.js (${files.length} files).`);
}

module.exports = { buildSw, collectFiles };
