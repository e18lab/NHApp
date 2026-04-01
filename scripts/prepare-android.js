const fs = require("fs");
const os = require("os");
const path = require("path");
const rootDir = path.resolve(__dirname, ".."); 
const androidDir = path.join(rootDir, "android");
const propFile = path.join(androidDir, "local.properties");
function detectSdkDir() {
  const env = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (env && fs.existsSync(env)) return env;
  const home = os.homedir();
  const candidates =
    process.platform === "win32"
      ? [
          path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk"),
          path.join(home, "AppData", "Local", "Android", "Sdk"),
        ]
      : process.platform === "darwin"
      ? [path.join(home, "Library", "Android", "sdk")]
      :  [path.join(home, "Android", "Sdk"), "/usr/lib/android-sdk"];
  return candidates.find(fs.existsSync);
}
function writeLocalProps(sdkDir) {
  const content = `sdk.dir=${sdkDir.replace(/\\/g, "\\\\")}\n`;
  fs.writeFileSync(propFile, content);
  console.log(`✅  android/local.properties created → ${sdkDir}`);
}
if (!fs.existsSync(androidDir)) {
  console.error("⚠️  No android/ directory. Run `npx expo prebuild` first.");
  process.exit(1);
}
const sdkDir = detectSdkDir();
if (!sdkDir) {
  console.error(
    "❌  Android SDK not found.\n" +
      "   • Install Android Studio or standalone platform-tools\n" +
      "   • Or set ANDROID_HOME / ANDROID_SDK_ROOT environment variable"
  );
  process.exit(1);
}
writeLocalProps(sdkDir);
