const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const JSON_DIR = path.join(__dirname, 'data', 'json');

/**
 * Main importer CLI
 */
function run() {
  console.log('==================================================');
  console.log('       CLOUDFLARE D1 DATABASE IMPORT UTILITY       ');
  console.log('==================================================');

  if (!fs.existsSync(JSON_DIR)) {
    console.error(`[ERROR] JSON directory not found at: ${JSON_DIR}. Please run the scraper first.`);
    process.exit(1);
  }

  const files = fs.readdirSync(JSON_DIR);
  const sqlFiles = files.filter(f => f.endsWith('.sql'));

  if (sqlFiles.length === 0) {
    console.log('[INFO] No SQL files found to import. Run the scraper first to generate SQL files.');
    process.exit(0);
  }

  console.log(`[INFO] Found ${sqlFiles.length} SQL dataset files to import:\n`);
  sqlFiles.forEach(f => console.log(`  - data/json/${f}`));
  console.log('\n==================================================');

  const args = process.argv.slice(2);
  const dbNameIndex = args.indexOf('--database');
  const isRemote = args.includes('--remote');
  
  let databaseName = '';
  if (dbNameIndex !== -1 && args[dbNameIndex + 1]) {
    databaseName = args[dbNameIndex + 1];
  }

  if (!databaseName) {
    console.log('\n[INSTRUCTIONS] How to import these SQL files to Cloudflare D1:');
    console.log('Run the following commands using Wrangler CLI:\n');
    
    sqlFiles.forEach(f => {
      const relativePath = path.join('data', 'json', f);
      console.log(`1. Local development D1 database:`);
      console.log(`   wrangler d1 execute YOUR_DB_NAME --file=./${relativePath.replace(/\\/g, '/')}`);
      console.log(`2. Remote production D1 database:`);
      console.log(`   wrangler d1 execute YOUR_DB_NAME --file=./${relativePath.replace(/\\/g, '/')} --remote\n`);
    });
    
    console.log('Alternatively, you can run this script and pass the database name:');
    console.log('   node d1_importer.js --database <YOUR_DB_NAME> [--remote]\n');
    process.exit(0);
  }

  // If database name is provided, let's generate and execute the command
  sqlFiles.forEach(f => {
    const relativePath = path.join('data', 'json', f);
    const sqlFilePath = `./${relativePath.replace(/\\/g, '/')}`;
    const remoteFlag = isRemote ? ' --remote' : '';
    const command = `wrangler d1 execute ${databaseName} --file=${sqlFilePath}${remoteFlag}`;
    
    console.log(`\n[EXEC] Executing: ${command}`);
    try {
      const output = execSync(command, { encoding: 'utf-8' });
      console.log('[SUCCESS] Import output:');
      console.log(output);
    } catch (err) {
      console.error(`[ERROR] Failed to execute import for ${f}:`, err.message);
      if (err.stdout) console.error(err.stdout);
      if (err.stderr) console.error(err.stderr);
    }
  });
}

run();
