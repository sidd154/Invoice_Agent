export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Skip registration during the build phase to prevent Next.js from hanging
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      console.log('[Inbuilt Autopilot] Skipping scheduler registration during the build phase.');
      return;
    }

    // Prevent registering duplicate cron tasks during development HMR or hot-reloading
    if (global.autopilotRegistered) {
      console.log('[Inbuilt Autopilot] Weekly background scheduler already registered.');
      return;
    }
    global.autopilotRegistered = true;

    // Only load and start scheduler on persistent Node.js servers, not during edge or build tasks
    const cron = await import('node-cron');
    const { runAutopilotReminders } = await import('./lib/autopilot');

    // Test schedule: run at 1:45 PM IST (Asia/Kolkata timezone)
    cron.schedule('45 13 * * *', async () => {
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
