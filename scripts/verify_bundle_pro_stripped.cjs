/**
 * Verification Script: Web Bundle Tree-Shaking Check
 * Confirms that the public web build contains 0 Pro proprietary code or signatures.
 */

const fs = require('fs');
const path = require('path');

const distAssetsDir = path.resolve(__dirname, '../dist/assets');

if (!fs.existsSync(distAssetsDir)) {
  console.error('Error: dist/assets directory does not exist. Run "pnpm run build" first.');
  process.exit(1);
}

const FORBIDDEN_PRO_PATTERNS = [
  'ASTRALYR_PRO_CORE_PROPRIETARY_ENGINE',
  'ASTRALYR_DESKTOP_PRO_V1',
  'Astralyr-Neural-Align-Pro',
];

console.log('====================================================');
console.log('Astralyr Web Bundle Pro-Stripping Verification');
console.log('====================================================');

const files = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
let violations = 0;
let totalJsBytes = 0;

for (const file of files) {
  const filePath = path.join(distAssetsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  totalJsBytes += content.length;

  for (const pattern of FORBIDDEN_PRO_PATTERNS) {
    if (content.includes(pattern)) {
      console.error(`❌ VIOLATION FOUND in ${file}: contains Pro signature "${pattern}"`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\nFAILED: Found ${violations} Pro signature(s) in public web bundle!`);
  process.exit(1);
} else {
  console.log(`✅ PASSED: Scanned ${files.length} JS bundle file(s) (${(totalJsBytes / 1024).toFixed(1)} KB total).`);
  console.log('✅ ZERO Pro proprietary modules or signatures detected in web distribution.');
  console.log('====================================================\n');
}
