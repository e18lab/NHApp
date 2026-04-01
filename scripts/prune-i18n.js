#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const getArg = (name, def = null) => {
  const i = argv.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return def;
  const a = argv[i];
  if (a.includes('=')) return a.split('=').slice(1).join('=');
  const next = argv[i + 1];
  if (!next || next.startsWith('--')) return true;
  return next;
};
const ROOT = path.resolve(getArg('root', '.'));
const LOCALE_PATH = path.resolve(getArg('locale', 'assets/i18n/en.json'));
const DRY = !argv.includes('--write');
const KEEPS = []
  .concat(getArg('keep', '').split(',').map(s => s.trim()).filter(Boolean))
  .map(globToRegExp);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'build', 'dist', 'android', 'ios', '.expo', '.expo-shared']);
const FILE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
function globToRegExp(glob) {
  const esc = s => s.replace(/[-/\\^$+?.()|{}]/g, '\\$&');
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') re += '.*';
    else if (ch === '?') re += '.';
    else if (ch === '[') {
      const j = glob.indexOf(']', i + 1);
      if (j > i) {
        re += glob.slice(i, j + 1);
        i = j;
      } else re += '\\[';
    } else re += esc(ch);
  }
  return new RegExp(`^${re}$`);
}
function walk(dir, out = []) {
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of ents) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      walk(p, out);
    } else if (FILE_EXTS.has(path.extname(e.name))) {
      out.push(p);
    }
  }
  return out;
}
function extractKeysFromFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const used = new Set();
  const reT = /\bt\(\s*(['"])([^'"]+)\1\s*(?:,|\))/g;
  // i18n.t('key')
  const rei18n = /\bi18n\.t\(\s*(['"])([^'"]+)\1\s*(?:,|\))/g;
  const add = (m) => {
    const key = m[2].trim();
    if (key) used.add(key);
  };
  let m;
  while ((m = reT.exec(src))) add(m);
  while ((m = rei18n.exec(src))) add(m);
  // warn about dynamic template literals around t(`...`)
  if (/\bt\(\s*`/.test(src) || /\bi18n\.t\(\s*`/.test(src)) {
    DYNAMIC_WARNINGS.add(file);
  }
  return used;
}
function flatten(obj, prefix = '', map = {}) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const k of Object.keys(obj)) {
      const next = prefix ? `${prefix}.${k}` : k;
      flatten(obj[k], next, map);
    }
  } else {
    map[prefix] = obj;
  }
  return map;
}
function unflatten(map) {
  const root = {};
  for (const [full, val] of Object.entries(map)) {
    const parts = full.split('.');
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (i === parts.length - 1) cur[p] = val;
      else cur = (cur[p] ||= {});
    }
  }
  return root;
}
function keyMatchesKeep(key) {
  return KEEPS.some(re => re.test(key));
}
function loadJson(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    console.error(`Failed to read/parse JSON: ${fp}\n`, e);
    process.exit(1);
  }
}
function writeJson(fp, obj) {
  const txt = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(fp, txt, 'utf8');
}
const DYNAMIC_WARNINGS = new Set();
(function main() {
  if (!fs.existsSync(LOCALE_PATH)) {
    console.error(`Locale file not found: ${LOCALE_PATH}`);
    process.exit(1);
  }
  const files = walk(ROOT);
  const usedKeys = new Set();
  for (const f of files) {
    for (const k of extractKeysFromFile(f)) usedKeys.add(k);
  }
  const locale = loadJson(LOCALE_PATH);
  const flat = flatten(locale);
  const allKeys = Object.keys(flat);
  // Build set of keys to keep: exact used + any that match --keep globs.
  const keep = new Set();
  // exact used
  for (const u of usedKeys) {
    if (flat[u] !== undefined) keep.add(u);
    // also keep parents if they are leaf-less in our json (no-op here),
    // and keep children if someone uses a parent as a namespace accidentally:
    // e.g. code uses 'reader.banner' (rare). We'll keep exact match only by default.
  }
  for (const k of allKeys) {
    if (keyMatchesKeep(k)) keep.add(k);
  }
  const unused = allKeys.filter(k => !keep.has(k));
  const keptFlat = {};
  [...keep].sort().forEach(k => (keptFlat[k] = flat[k]));
  const pruned = unflatten(keptFlat);
  console.log('—— i18n prune report ——');
  console.log(`Scanned files: ${files.length}`);
  console.log(`Locale file:   ${path.relative(process.cwd(), LOCALE_PATH)}`);
  console.log(`Found keys in code: ${usedKeys.size}`);
  console.log(`Locale keys total:  ${allKeys.length}`);
  console.log(`Kept: ${keep.size} | Removed: ${unused.length}`);
  if (DYNAMIC_WARNINGS.size) {
    console.log(
      `⚠ Detected dynamic i18n keys in ${DYNAMIC_WARNINGS.size} files (template literals).\n` +
      `  Consider adding --keep masks for those namespaces.\n`
    );
    for (const f of [...DYNAMIC_WARNINGS].slice(0, 5)) {
      console.log('  •', path.relative(process.cwd(), f));
    }
    if (DYNAMIC_WARNINGS.size > 5) console.log('  …');
  }
  if (DRY) {
    console.log('\nDry run. Nothing written. Use --write to apply changes.');
    console.log('\nSample of unused keys to be removed:');
    unused.slice(0, 20).forEach(k => console.log('  -', k));
    if (unused.length > 20) console.log(`  …and ${unused.length - 20} more`);
  } else {
    const bak = LOCALE_PATH + '.bak';
    fs.copyFileSync(LOCALE_PATH, bak);
    writeJson(LOCALE_PATH, pruned);
    console.log(`\n✔ Wrote pruned locale. Backup saved to ${path.relative(process.cwd(), bak)}`);
  }
})();



