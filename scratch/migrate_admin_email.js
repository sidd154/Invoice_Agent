const { Client } = require('pg');

async function migrate() {
  const connectionString = "postgresql://postgres.acbymfzwsugaxrnvqrsh:221001154%40Siddhanth@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Add column if it doesn't exist
    await client.query(`
      ALTER TABLE global_settings 
      ADD COLUMN IF NOT EXISTS admin_alert_email VARCHAR(255) DEFAULT 'finance@pixel-studios.com';
    `);

    // Ensure row 1 has the default
    await client.query(`
      UPDATE global_settings 
      SET admin_alert_email = 'finance@pixel-studios.com' 
      WHERE id = 1 AND admin_alert_email IS NULL;
    `);

    console.log("Migration successful: Added admin_alert_email to global_settings");
  } catch (err) {
    console.error("Migration Error:", err);
  } finally {
    await client.end();
  }
}

migrate();
