import fs from "fs";
import path from "path";
const root = path.resolve(process.cwd());
const pkgPath = path.join(root, "package.json");
const appPath = path.join(root, "app.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const app = JSON.parse(fs.readFileSync(appPath, "utf8"));
const ver = pkg.version || "0.0.1";
const parts = ver.split(".").map((x) => x.padStart(2, "0"));
const versionCode = parseInt(parts.join("").padEnd(5, "0"), 10);
if (app.expo.version === ver && app.expo.android?.versionCode === versionCode) {
  console.log(`[sync-version] app.json уже содержит ${ver} (${versionCode})`);
  process.exit(0);
}
app.expo.version = ver;
app.expo.android = { ...app.expo.android, versionCode };
fs.writeFileSync(appPath, JSON.stringify(app, null, 2));
console.log(
  `[sync-version] → app.json обновлён до ${ver} (code ${versionCode})`
);
