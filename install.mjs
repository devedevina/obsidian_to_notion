// Copies the built plugin into an Obsidian vault's plugin folder.
// Usage: npm run install-vault -- "/path/to/your/vault"
//    or: OBSIDIAN_VAULT="/path/to/your/vault" npm run install-vault
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";

const vaultArg = process.argv[2] || process.env.OBSIDIAN_VAULT;
if (!vaultArg) {
  console.error('보관함 경로를 알려주세요. 예: npm run install-vault -- "/path/to/your/vault"');
  process.exit(1);
}
const vault = resolve(vaultArg);
if (!existsSync(join(vault, ".obsidian"))) {
  console.error(`${vault} 에 .obsidian 폴더가 없어요. 옵시디언 보관함 경로가 맞는지 확인해 주세요.`);
  process.exit(1);
}
const dest = join(vault, ".obsidian", "plugins", "obsidian-to-notion");
mkdirSync(dest, { recursive: true });
for (const f of ["main.js", "manifest.json", "styles.css"]) {
  copyFileSync(f, join(dest, f));
}
console.log(`설치 완료: ${dest}`);
