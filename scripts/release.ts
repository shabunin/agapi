import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function runCommand(command: string) {
  console.log(`Running: ${command}`);
  execSync(command, { stdio: 'inherit', cwd: projectRoot });
}

function findApkFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findApkFiles(filePath, fileList);
    } else if (file.endsWith('.apk') && filePath.includes('/release/')) {
      fileList.push(filePath);
    }
  }
  return fileList;
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

  // 2. Build for Windows
  console.log('Building Windows app...');
  runCommand('npm run build:windows');

  // 3. Build for Android
  console.log('Building Android app...');
  runCommand('npm run build:android');

  // 4. Gather artifacts
  console.log('Gathering build artifacts...');
  const artifacts: string[] = [];

  // Windows artifacts
  const windowsTargetDir = path.join(projectRoot, 'src-tauri', 'target', 'x86_64-pc-windows-msvc', 'release');
  
  // Look for NSIS installer matching version
  const bundleNsisDir = path.join(windowsTargetDir, 'bundle', 'nsis');
  if (fs.existsSync(bundleNsisDir)) {
    const files = fs.readdirSync(bundleNsisDir);
    for (const file of files) {
      if (file.endsWith('.exe') && file.includes(version)) {
        const destPath = path.join(windowsTargetDir, `agapi-${tagName}-x64-setup.exe`);
        fs.copyFileSync(path.join(bundleNsisDir, file), destPath);
        artifacts.push(destPath);
        console.log(`Gathered Windows installer: ${destPath}`);
      }
    }
  }

  // Raw Windows exe
  const appExe = path.join(windowsTargetDir, 'app.exe');
  if (fs.existsSync(appExe)) {
    const renamedExe = path.join(windowsTargetDir, `agapi-${tagName}-x64.exe`);
    fs.copyFileSync(appExe, renamedExe);
    artifacts.push(renamedExe);
    console.log(`Gathered Windows executable: ${renamedExe}`);
  }

  // Android artifacts
  const androidApkDir = path.join(projectRoot, 'src-tauri', 'gen', 'android', 'app', 'build', 'outputs', 'apk');
  const apks = findApkFiles(androidApkDir);
  for (const apkPath of apks) {
    const basename = path.basename(apkPath);
    // e.g. app-arm64-release-signed.apk -> agapi-v0.0.1-arm64-release-signed.apk
    const renamedBasename = basename.replace(/^app-/, `agapi-${tagName}-`);
    const destPath = path.join(path.dirname(apkPath), renamedBasename);
    fs.copyFileSync(apkPath, destPath);
    artifacts.push(destPath);
    console.log(`Gathered Android APK: ${destPath}`);
  }

  // Dedup artifacts to be absolutely safe
  const uniqueArtifacts = [...new Set(artifacts)];

  if (uniqueArtifacts.length === 0) {
    console.error('Error: No release artifacts found. Did builds complete successfully?');
    process.exit(1);
  }

  // 5. Commit and tag version bump
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

  // Check if tag already exists and delete it locally/remotely to overwrite if re-running
  try {
    execSync(`git tag -d ${tagName}`, { stdio: 'ignore', cwd: projectRoot });
  } catch (e) {}

  console.log(`Creating Git tag ${tagName}...`);
  runCommand(`git tag -a ${tagName} -m "Release ${tagName}"`);

  // 6. Push to repository
  console.log('Pushing to GitHub...');
  runCommand('git push origin main');
  runCommand(`git push origin ${tagName} --force`);

  // 7. Create GitHub Release using gh CLI
  console.log(`Creating GitHub Release for ${tagName}...`);
  const artifactArgs = uniqueArtifacts.map(art => `"${art}"`).join(' ');
  
  // Delete existing draft/release on GitHub if exists to avoid conflicts when retrying
  try {
    execSync(`gh release delete ${tagName} --yes --cleanup-tag`, { stdio: 'ignore', cwd: projectRoot });
    // Pause briefly to let GitHub process the deletion
    execSync('sleep 2');
  } catch (e) {}

  runCommand(`gh release create ${tagName} ${artifactArgs} --title "Release ${tagName}" --notes "Release version ${version}" --draft`);

  console.log(`\n🎉 Success! Release ${tagName} created as a draft on GitHub.`);
  console.log('Visit your repository to publish the release when ready!');
}

main();
