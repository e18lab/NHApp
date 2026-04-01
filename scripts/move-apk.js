const fs = require("fs");
const path = require("path");
const pkg = require("../package.json");
const version = pkg.version || "0.0.0";
const releaseDir = path.join(
  __dirname,
  "..",
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  "release"
);
const outDir = path.join(__dirname, "..", "output_android");
fs.mkdirSync(outDir, { recursive: true });

// Support both single app-release.apk and split APKs (app-arm64-v8a-release.apk, app-armeabi-v7a-release.apk)
const singleApk = path.join(releaseDir, "app-release.apk");
const apkFiles = fs.existsSync(releaseDir)
  ? fs.readdirSync(releaseDir).filter((f) => f.endsWith(".apk"))
  : [];

if (apkFiles.length === 0 && !fs.existsSync(singleApk)) {
  console.error(`❌  No APK found in ${releaseDir}`);
  process.exit(1);
}

const toCopy = fs.existsSync(singleApk)
  ? [{ src: singleApk, name: `NHApp-Android-Setup-${version}.apk` }]
  : apkFiles.map((f) => {
      const abi = f.replace("app-", "").replace("-release.apk", "") || "universal";
      return {
        src: path.join(releaseDir, f),
        name: `NHApp-Android-Setup-${version}-${abi}.apk`,
      };
    });

toCopy.forEach(({ src, name }) => {
  const outPath = path.join(outDir, name);
  fs.copyFileSync(src, outPath);
  console.log(`✅  Copied → ${outPath}`);
});
