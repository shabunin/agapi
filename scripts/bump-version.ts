import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function getNextVersion(current: string, action: string): string {
  const cleanCurrent = current.replace(/^v/, '');
  const match = cleanCurrent.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) {
    throw new Error(`Invalid current version format: ${current}`);
  }

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = parseInt(match[3], 10);
  const extra = match[4]; // e.g. -beta, -rc1

  if (action === 'major') {
    return `${major + 1}.0.0`;
  } else if (action === 'minor') {
    return `${major}.${minor + 1}.0`;
  } else if (action === 'patch') {
    return `${major}.${minor}.${patch + 1}`;
  }

  // If action is a specific version string, return it
  return action.replace(/^v/, '');
}

function bumpVersion() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npx tsx scripts/bump-version.ts <patch|minor|major|version_string>');
    process.exit(1);
  }

  // 1. Update package.json
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.error(`package.json not found at ${packageJsonPath}`);
    process.exit(1);
  }
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const currentVersion = packageJson.version;
  const newVersion = getNextVersion(currentVersion, arg);

  console.log(`Bumping version from ${currentVersion} to ${newVersion}...`);

  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`Updated package.json version to ${newVersion}`);

  // 2. Update src-tauri/tauri.conf.json
  const tauriConfPath = path.join(projectRoot, 'src-tauri', 'tauri.conf.json');
  if (fs.existsSync(tauriConfPath)) {
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'));
    tauriConf.version = newVersion;
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
    console.log(`Updated tauri.conf.json version to ${newVersion}`);
  } else {
    console.warn(`tauri.conf.json not found at ${tauriConfPath}`);
  }

  // 3. Update src-tauri/Cargo.toml
  const cargoTomlPath = path.join(projectRoot, 'src-tauri', 'Cargo.toml');
  if (fs.existsSync(cargoTomlPath)) {
    let cargoToml = fs.readFileSync(cargoTomlPath, 'utf-8');
    // Replace the first match of version = "..." which belongs to the [package] section
    const versionRegex = /(version\s*=\s*")([^"]+)(")/;
    if (versionRegex.test(cargoToml)) {
      cargoToml = cargoToml.replace(versionRegex, `$1${newVersion}$3`);
      fs.writeFileSync(cargoTomlPath, cargoToml);
      console.log(`Updated Cargo.toml version to ${newVersion}`);
    } else {
      console.warn(`Could not find version field in Cargo.toml`);
    }
  } else {
    console.warn(`Cargo.toml not found at ${cargoTomlPath}`);
  }

  console.log(`Successfully bumped version to ${newVersion}!`);
}

bumpVersion();
