const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Get the last 15 commits with format: hash|date|subject
  const gitLog = execSync('git log -n 15 --pretty=format:"%h|%ad|%s" --date=short').toString();
  
  const entries = gitLog.split('\n').filter(Boolean).map((line, index) => {
    const [hash, date, message] = line.split('|');
    
    // Read version from package.json
    const pkgPath = path.join(__dirname, '../package.json');
    let major = 1, minor = 3, basePatch = 0;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const parts = pkg.version.split('.');
      major = parseInt(parts[0], 10) || 0;
      minor = parseInt(parts[1], 10) || 1;
      basePatch = parseInt(parts[2], 10) || 0;
    } catch (e) {}
    
    // Use basePatch for the latest commit, and decrement for older ones
    const patch = basePatch - index;

    return {
      version: `v${major}.${minor}.${patch >= 0 ? patch : 0}`,
      date: date,
      commit: hash,
      changes: [message]
    };
  });

  // Ensure target folder exists
  const targetDir = path.join(__dirname, '../lib');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(targetDir, 'changelog.json'),
    JSON.stringify(entries, null, 2)
  );
  console.log('Changelog generated successfully!');
} catch (error) {
  console.error('Failed to generate changelog:', error.message);
  // Write a fallback file if git log fails (e.g. if git is not installed in the target container)
  const fallbackPath = path.join(__dirname, '../lib/changelog.json');
  if (!fs.existsSync(fallbackPath)) {
    const fallbackData = [
      {
        version: "v1.3.0",
        date: new Date().toISOString().split('T')[0],
        commit: "unknown",
        changes: ["Development build (no git history available)"]
      }
    ];
    fs.writeFileSync(fallbackPath, JSON.stringify(fallbackData, null, 2));
  }
}
