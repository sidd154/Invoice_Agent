import { fetchSheetsData } from '@/lib/sheets';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { invoices, customers } = await fetchSheetsData();
    return NextResponse.json({ invoices, customers });
  } catch (error) {
    console.error('Sheets Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
