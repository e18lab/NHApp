#!/usr/bin/env node
/**
 * Applies Gradle TLS handshake_failure fix (idempotent).
 * Run: npm run fixGradle  (or npx run fixGradle)
 *
 * Ensures:
 * - android/gradle.properties: TLS in org.gradle.jvmargs and systemProp.https.protocols
 * - android/init.gradle: sets https.protocols before dependency resolution
 * - android/gradlew.bat and android/gradlew: invoke Gradle with -I init.gradle
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ANDROID = path.join(ROOT, 'android');

const TLS_JVM_ARGS_SUFFIX = ' -Dhttps.protocols=TLSv1.2,TLSv1.3';
const SYSTEM_PROP = 'systemProp.https.protocols=TLSv1.2,TLSv1.3';
const INIT_GRADLE_CONTENT = `// Force TLS protocols before any dependency resolution (fix handshake_failure with Maven Central)
System.setProperty("https.protocols", "TLSv1.2,TLSv1.3")
logger.lifecycle("[init.gradle] Set https.protocols=TLSv1.2,TLSv1.3")
`;

function fixGradleProperties() {
  const file = path.join(ANDROID, 'gradle.properties');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '# Project-wide Gradle settings.\n\n' + SYSTEM_PROP + '\n', 'utf8');
    console.log('Created android/gradle.properties with TLS props.');
    return;
  }
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (!content.includes('systemProp.https.protocols=TLSv1.2,TLSv1.3')) {
    content = content.trimEnd() + '\n# Force TLS protocols for dependency resolution (handshake_failure fix)\n' + SYSTEM_PROP + '\n';
    changed = true;
  }

  const jvmargsMatch = content.match(/^org\.gradle\.jvmargs=(.*)$/m);
  if (jvmargsMatch) {
    const line = jvmargsMatch[0];
    if (!line.includes('https.protocols')) {
      const newLine = line.replace(/^org\.gradle\.jvmargs=(.*)$/, 'org.gradle.jvmargs=$1' + TLS_JVM_ARGS_SUFFIX);
      content = content.replace(line, newLine);
      changed = true;
    }
  } else {
    content = content.trimEnd() + '\n# TLS: avoid handshake_failure when downloading from Maven Central\norg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m' + TLS_JVM_ARGS_SUFFIX + '\n';
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated android/gradle.properties with TLS settings.');
  }
}

function fixInitGradle() {
  const file = path.join(ANDROID, 'init.gradle');
  const desired = INIT_GRADLE_CONTENT.trimEnd() + '\n';
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== desired) {
    fs.writeFileSync(file, desired, 'utf8');
    console.log('Written android/init.gradle.');
  }
}

function fixGradlewBat() {
  const file = path.join(ANDROID, 'gradlew.bat');
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('init.gradle')) return;
  // Match line ending with gradle-wrapper.jar" %* or similar
  const match = content.match(/(.*-jar "%APP_HOME%\\gradle\\wrapper\\gradle-wrapper\.jar")(\s+%\*)/m);
  if (match) {
    const [, before, after] = match;
    const newLine = before + ' -I "%APP_HOME%\\init.gradle"' + after;
    content = content.replace(match[0], newLine);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Patched android/gradlew.bat to use init.gradle.');
  }
}

function fixGradlew() {
  const file = path.join(ANDROID, 'gradlew');
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('init.gradle')) return;
  const pattern = /(-jar "\$APP_HOME\/gradle\/wrapper\/gradle-wrapper\.jar")\s*\\\s*\n(\s*)("\$@")/m;
  const replacement = '$1 \\\n$2-I "$APP_HOME/init.gradle" \\\n$2$3';
  if (pattern.test(content)) {
    content = content.replace(pattern, replacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Patched android/gradlew to use init.gradle.');
  }
}

if (!fs.existsSync(ANDROID)) {
  console.error('android/ not found. Run from project root.');
  process.exit(1);
}

fixGradleProperties();
fixInitGradle();
fixGradlewBat();
fixGradlew();
console.log('Gradle TLS fix applied. Run "npm run fixGradle" anytime to re-apply.');
