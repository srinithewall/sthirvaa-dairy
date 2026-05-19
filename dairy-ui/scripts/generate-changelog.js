const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Get the last 15 commits with format: hash|date|subject
  const gitLog = execSync('git log -n 15 --pretty=format:"%h|%ad|%s" --date=short').toString();
  
  const entries = gitLog.split('\n').filter(Boolean).map((line, index) => {
    const [hash, date, message] = line.split('|');
    
    // We can extract/mock version based on commit count index
    // e.g., if there are 200 commits, index 0 is latest, version v1.3.<index>
    const revCount = parseInt(execSync('git rev-list --count HEAD').toString().trim(), 10);
    const major = 1;
    const minor = 3;
    const patch = revCount - index;

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
