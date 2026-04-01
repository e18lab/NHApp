#!/usr/bin/env node
/**
 * Applies Android release/size defaults (idempotent).
 * Run after clone so you don't have to set options by hand.
 * Ensures: gradle.properties (minify, shrink, bundleCompression), app/build.gradle (splits), proguard-rules.pro.
 * Use: npm run android-setup  (runs fixGradle + this script)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ANDROID = path.join(ROOT, 'android');
const APP_BUILD = path.join(ANDROID, 'app', 'build.gradle');
const PROGUARD = path.join(ANDROID, 'app', 'proguard-rules.pro');

const GRADLE_PROPS_BLOCK = `
# Release APK size reduction (~26 MB target)
android.enableMinifyInReleaseBuilds=true
android.enableShrinkResourcesInReleaseBuilds=true
android.enableBundleCompression=true
`;

const SPLITS_BLOCK = `
    // Split APKs by ABI: one APK per architecture (~26 MB each instead of one large universal)
    splits {
        abi {
            enable true
            reset()
            include 'armeabi-v7a', 'arm64-v8a'
            universalApk false
        }
    }
`;

const PROGUARD_BLOCK = `# React Native / Hermes (minify release)
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

`;

function applyGradleProperties() {
  const file = path.join(ANDROID, 'gradle.properties');
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  const hasBlock = content.includes('android.enableMinifyInReleaseBuilds=true');
  if (hasBlock) return;
  content = content.trimEnd() + GRADLE_PROPS_BLOCK;
  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated android/gradle.properties (release/size flags).');
}

function applyBuildGradleSplits() {
  if (!fs.existsSync(APP_BUILD)) return;
  let content = fs.readFileSync(APP_BUILD, 'utf8');
  if (content.includes('splits {')) return;
  // Insert after defaultConfig { ... } block, before signingConfigs
  const insertPoint = content.indexOf('    signingConfigs {');
  if (insertPoint === -1) return;
  content = content.slice(0, insertPoint) + SPLITS_BLOCK + content.slice(insertPoint);
  fs.writeFileSync(APP_BUILD, content, 'utf8');
  console.log('Added ABI splits to android/app/build.gradle.');
}

function applyProguardRules() {
  if (!fs.existsSync(PROGUARD)) return;
  let content = fs.readFileSync(PROGUARD, 'utf8');
  if (content.includes('com.facebook.hermes.unicode')) return;
  const insert = PROGUARD_BLOCK.trimEnd() + '\n\n';
  const idx = content.indexOf('# Add project specific');
  if (idx !== -1) {
    content = content.slice(0, idx) + insert + content.slice(idx);
  } else {
    content = insert + content;
  }
  fs.writeFileSync(PROGUARD, content, 'utf8');
  console.log('Added Hermes/RN keep rules to android/app/proguard-rules.pro.');
}

if (!fs.existsSync(ANDROID)) {
  console.error('android/ not found. Run from project root.');
  process.exit(1);
}

applyGradleProperties();
applyBuildGradleSplits();
applyProguardRules();
console.log('Android release defaults applied.');
