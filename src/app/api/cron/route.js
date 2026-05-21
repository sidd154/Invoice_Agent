import { NextResponse } from 'next/server';
import { runAutopilotReminders } from '@/lib/autopilot';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    // 1. Authorization check for Cron triggers
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Trigger the shared Autopilot Engine
    const result = await runAutopilotReminders();

    return NextResponse.json({
      success: true,
      message: `Processed automated cron run successfully.`,
      emailsSent: result.emailsSent || []
    });

  } catch (error) {
    console.error('Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
