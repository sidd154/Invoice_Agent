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

    // Check every minute to see if it matches the DB-configured days/time
    cron.schedule('* * * * *', async () => {
      console.log(`[Inbuilt Autopilot] Background scheduler heartbeat - ${new Date().toISOString()}`);
      try {
        const result = await runAutopilotReminders();
        if (result && !result.message?.includes('Not scheduled')) {
          console.log('[Inbuilt Autopilot] Background scheduler execution completed:', result);
        }
      } catch (err) {
        console.error('[Inbuilt Autopilot] Background scheduler execution failed:', err);
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    console.log('[Inbuilt Autopilot] Weekly background scheduler registered successfully in Asia/Kolkata timezone!');
  }
}
