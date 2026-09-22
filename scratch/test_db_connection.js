const { Client } = require('pg');

async function testConnection(host, port) {
  const connectionString = `postgresql://postgres.acbymfzwsugaxrnvqrsh:221001154%40Siddhanth@${host}:${port}/postgres`;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`\n>>> SUCCESS: Connected to Supabase using ${host}!`);
    const res = await client.query("SELECT email FROM customers LIMIT 1;");
    console.log("Query success! Sample customer email:", res.rows);
    return true;
  } catch (err) {
    const msg = err.message || err;
    if (msg.includes("password authentication failed")) {
      console.log(`\n>>> PASSWORD FOUND: ${host} recognized the user but password failed!`);
      return true;
    }
    process.stdout.write("."); // Print dot for failures
    return false;
  } finally {
    await client.end();
  }
}

async function main() {
  const regions = ['ap-southeast-1', 'ap-south-1', 'us-east-1'];
  
  console.log("Probing regional Supavisor pooler hosts for project acbymfzwsugaxrnvqrsh...");
  for (const region of regions) {
    for (const prefix of ['aws-0', 'aws-1']) {
      const host = `${prefix}-${region}.pooler.supabase.com`;
      const success = await testConnection(host, 6543);
      if (success) {
        console.log(`\nWinner host: ${host}`);
        return;
      }
    }
  }
  console.log("\nProbing finished.");
}

main();
