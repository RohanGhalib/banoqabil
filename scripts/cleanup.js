const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '../app/api/students/ [id]');

try {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    console.log('✅ Typo directory app/api/students/ [id] removed successfully.');
  } else {
    console.log('ℹ️ Typo directory app/api/students/ [id] does not exist.');
  }
} catch (err) {
  console.error('❌ Error during cleanup:', err);
  process.exit(1);
}
