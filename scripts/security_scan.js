// scripts/security_scan.js
// Simple security scanner for the Lonkind app source code.
// Scans for unsafe patterns and generates a report.

const fs = require('fs');
const path = require('path');

function scanFile(filePath) {
  const issues = [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    // Skip lines that reference environment variables
    if (line.includes('process.env')) return;
    patterns.forEach(p => {
      const match = line.match(p.regex);
      if (match) {
        issues.push({
          file: filePath,
          line: idx + 1,
          column: match.index ?? 0,
          snippet: line.trim(),
          description: p.description
        });
      }
    });
  });
  return issues;
}

const SRC_ROOT = path.resolve(__dirname, '../src');
const REPORT_PATH = path.resolve(__dirname, '../security_scan_report.md');

const patterns = [
  { regex: /eval\s*\(/, description: 'Use of eval() is unsafe' },
  { regex: /new\s+Function\s*\(/, description: 'Dynamic function constructor' },
  { regex: /dangerouslySetInnerHTML\s*=\s*\{\s*__html\s*:/, description: 'dangerouslySetInnerHTML can lead to XSS' },
  { regex: /setTimeout\s*\([^,]+?,\s*['\"]/ , description: 'setTimeout with string argument (code injection)' },
  { regex: /import\s*\([^'\"]*['\"]\s*\+/, description: 'Dynamic import with non‑literal path' },
  { regex: /http:\/\//, description: 'Non‑HTTPS URL' },
  // Match string literals of 32+ characters (e.g., API keys)
  { regex: /['\"][A-Za-z0-9_]{32,}['\"]/ , description: 'Potential hard‑coded credential' }
];

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'build'].includes(entry.name)) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.js', '.jsx', '.ts', '.tsx', '.html'].includes(ext)) {
        yield full;
      }
    }
  }
}

function runScan() {
  const allIssues = [];
  for (const file of walk(SRC_ROOT)) {
    allIssues.push(...scanFile(file));
  }
  const reportLines = [];
  reportLines.push('# Security Scan Report');
  reportLines.push('\nGenerated on ' + new Date().toISOString() + '\n');
  if (allIssues.length === 0) {
    reportLines.push('**No security issues found.**');
  } else {
    reportLines.push(`Found ${allIssues.length} issue(s):`);
    allIssues.forEach((iss, i) => {
      reportLines.push(`\n## Issue ${i + 1}`);
      reportLines.push(`- **File:** ${iss.file}`);
      reportLines.push(`- **Location:** line ${iss.line}, column ${iss.column}`);
      reportLines.push(`- **Description:** ${iss.description}`);
      reportLines.push(`- **Snippet:** \`${iss.snippet}\``);
    });
    reportLines.push('\n\nPlease address the above issues before deployment. The build will fail if any issues remain.');
  }
  fs.writeFileSync(REPORT_PATH, reportLines.join('\n'), 'utf8');
  if (allIssues.length > 0) {
    console.error(`Security scan found ${allIssues.length} issue(s). See ${REPORT_PATH}`);
    process.exit(1);
  } else {
    console.log('Security scan passed. No issues found.');
    process.exit(0);
  }
}

runScan();
