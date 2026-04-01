#!/usr/bin/env node
/**
 * Deep clean for Android build: removes build dirs and Gradle/CMake caches
 * so that the next build regenerates codegen and doesn't fail on broken paths.
 * Run: npm run android-clean-deep
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ANDROID = path.join(ROOT, 'android');
const USER_HOME = process.env.USERPROFILE || process.env.HOME || '';

const DIRS_TO_REMOVE = [
  path.join(ANDROID, 'app', 'build'),
  path.join(ANDROID, 'app', '.cxx'),
  path.join(ANDROID, 'build'),
  path.join(ANDROID, '.gradle'),
  path.join(ROOT, 'node_modules', 'react-native-gesture-handler', 'android', '.cxx'),
  path.join(ROOT, 'node_modules', 'react-native-gesture-handler', 'android', 'build'),
  path.join(ROOT, 'node_modules', '@react-native-async-storage', 'async-storage', 'android', 'build'),
  path.join(ROOT, 'node_modules', 'react-native-pager-view', 'android', 'build'),
  path.join(ROOT, 'node_modules', 'react-native-screens', 'android', 'build'),
  path.join(ROOT, 'node_modules', 'react-native-safe-area-context', 'android', 'build'),
  path.join(ROOT, 'node_modules', 'react-native-svg', 'android', 'build'),
  path.join(ROOT, 'node_modules', 'react-native-reanimated', 'android', 'build'),
  path.join(ROOT, 'node_modules', 'react-native-webview', 'android', 'build'),
  path.join(ROOT, 'node_modules', 'expo-modules-core', 'android', 'build'),
  path.join(ROOT, 'node_modules', 'expo-modules-core', 'android', '.cxx'),
];

if (USER_HOME) {
  DIRS_TO_REMOVE.push(path.join(USER_HOME, '.gradle', 'caches', '8.13', 'transforms'));
  DIRS_TO_REMOVE.push(path.join(USER_HOME, '.gradle', 'caches', '8.14', 'transforms'));
}

function rmRecursive(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('Removed:', path.relative(ROOT, dir) || dir);
  } catch (e) {
    console.warn('Could not remove:', dir, e.message);
  }
}

if (!fs.existsSync(ANDROID)) {
  console.error('android/ not found.');
  process.exit(1);
}

console.log('Deep cleaning Android / Gradle caches...');
DIRS_TO_REMOVE.forEach(rmRecursive);
console.log('Done. Run: npm run android-release:assemble  (or npm run android-release)');
process.exit(0);
