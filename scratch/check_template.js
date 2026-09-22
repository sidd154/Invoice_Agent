const { Client } = require('pg');

async function checkTemplate() {
  const connectionString = "postgresql://postgres.acbymfzwsugaxrnvqrsh:221001154%40Siddhanth@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const res = await client.query("SELECT first_notice FROM email_templates WHERE id = 1;");
    console.log("Current template saved in DB:\n\n" + res.rows[0].first_notice);
  } catch (err) {
    console.error("Error connecting to database:", err);
  } finally {
    await client.end();
  }
}

checkTemplate();
