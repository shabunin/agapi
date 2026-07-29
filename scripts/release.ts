import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * Bumps the version, tags it, and pushes. Building and publishing happen
 * entirely in .github/workflows/release.yml, triggered by the tag push —
 * this script does not build or touch GitHub Releases itself.
 */

function runCommand(command: string) {
  console.log(`Running: ${command}`);
  execSync(command, { stdio: 'inherit', cwd: projectRoot });
}

function main() {
  const versionArg = process.argv[2];
  if (!versionArg) {
    console.error('Usage: npx tsx scripts/release.ts <patch|minor|major|version_string>');
    process.exit(1);
  }

  // Check git status
  console.log('Checking git status...');
  const gitStatus = execSync('git status --porcelain', { cwd: projectRoot }).toString().trim();
  if (gitStatus.length > 0) {
    console.warn('WARNING: You have uncommitted changes in your repository:');
    console.warn(gitStatus);
    console.warn('Continuing anyway...\n');
  }

  // 1. Run bump-version
  runCommand(`npx tsx scripts/bump-version.ts ${versionArg}`);

  // Read the new version
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const version = packageJson.version;
  const tagName = `v${version}`;

  // 2. Commit the version bump
  console.log('Committing version bump to Git...');
  // Force add package.json, tauri.conf.json, Cargo.toml in case they are gitignored (which they shouldn't be)
  runCommand('git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml');

  // Check if there is anything to commit
  const hasChanges = execSync('git diff --cached --name-only', { cwd: projectRoot }).toString().trim().length > 0;
  if (hasChanges) {
    runCommand(`git commit -m "chore: release ${tagName}"`);
  } else {
    console.log('No changes to commit for release.');
  }

  // If retrying a version, clear out the previous local tag and the
  // GitHub Release + tag the workflow made for it last time.
  try {
    execSync(`git tag -d ${tagName}`, { stdio: 'ignore', cwd: projectRoot });
  } catch (e) {}
  try {
    execSync(`gh release delete ${tagName} --yes --cleanup-tag`, { stdio: 'ignore', cwd: projectRoot });
  } catch (e) {}

  console.log(`Creating Git tag ${tagName}...`);
  runCommand(`git tag -a ${tagName} -m "Release ${tagName}"`);

  // 3. Push — the tag push triggers .github/workflows/release.yml, which
  // builds Windows / macOS (x86_64 + aarch64) / Android and uploads them
  // to a draft GitHub Release.
  console.log('Pushing to GitHub...');
  runCommand('git push origin main');
  runCommand(`git push origin ${tagName}`);

  console.log(`\nPushed ${tagName}. GitHub Actions is now building Windows, macOS, and Android.`);
  console.log(`Watch it: gh run watch --repo shabunin/agapi, or the Actions tab.`);
  console.log('Once all jobs finish, review and publish the draft release on GitHub.');
}

main();
