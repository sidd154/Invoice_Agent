export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Prevent registering duplicate cron tasks during development HMR or hot-reloading
    if (global.autopilotRegistered) {
      console.log('[Inbuilt Autopilot] Weekly background scheduler already registered.');
      return;
    }
    global.autopilotRegistered = true;

    // Only load and start scheduler on persistent Node.js servers, not during edge or build tasks
    const cron = await import('node-cron');
    const { runAutopilotReminders } = await import('./lib/autopilot');

    // Schedule to run every Monday at 11:00 AM IST (Asia/Kolkata timezone)
    cron.schedule('0 11 * * 1', async () => {
      console.log('[Inbuilt Autopilot] Triggering Monday outstanding invoice sync & reminders...');
      try {
        const result = await runAutopilotReminders();
        console.log('[Inbuilt Autopilot] Execution completed successfully:', result);
      } catch (err) {
        console.error('[Inbuilt Autopilot] Execution failed:', err);
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    console.log('[Inbuilt Autopilot] Weekly background scheduler registered successfully in Asia/Kolkata timezone!');
  }
}
