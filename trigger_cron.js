async function trigger() {
  console.log('Triggering autopilot manually via /api/cron endpoint...');
  try {
    const res = await fetch('http://localhost:3000/api/cron');
    const data = await res.json();
    console.log('Autopilot Execution Response:', data);
  } catch (err) {
    console.error('Error triggering autopilot:', err.message);
  }
}

trigger();
