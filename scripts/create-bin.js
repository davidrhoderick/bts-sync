const fs = require('fs');
const path = require('path');

const binDir = path.resolve(__dirname, '../bin');
const binPath = path.join(binDir, 'main.js');
const shebang = '#!/usr/bin/env node\n';

try {
  // Ensure the bin directory exists
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir);
  }

  // Create the bin script with the shebang
  const binContent = `${shebang}import('../dist/main.js');`;
  fs.writeFileSync(binPath, binContent, { mode: 0o755 });
  console.log('Created bin/main.js with shebang.');
} catch (error) {
  console.error('Error creating bin file:', error);
}
