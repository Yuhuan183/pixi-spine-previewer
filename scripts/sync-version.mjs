// Mirrors package.json's version into the desktop shell. Wired to npm's `version` lifecycle
// hook, so `npm version patch|minor` bumps all four files inside the same commit and the
// release workflow can trust package.json as the single source of truth.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), 'utf8');
const write = (rel, text) => writeFileSync(new URL(rel, root), text);

const { version } = JSON.parse(read('package.json'));

write('src-tauri/tauri.conf.json', read('src-tauri/tauri.conf.json').replace(/"version": "[^"]+"/, `"version": "${version}"`));
write('src-tauri/Cargo.toml', read('src-tauri/Cargo.toml').replace(/^version = "[^"]+"/m, `version = "${version}"`));
write(
  'src-tauri/Cargo.lock',
  read('src-tauri/Cargo.lock').replace(/(\[\[package\]\]\nname = "spine-previewer"\nversion = ")[^"]+(")/, `$1${version}$2`),
);

console.log(`version ${version} → src-tauri/tauri.conf.json, Cargo.toml, Cargo.lock`);
