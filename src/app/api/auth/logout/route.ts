import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies } from '../utils';

export async function POST(request: NextRequest) {
  try {
    // Clear all authentication cookies
    await clearAuthCookies();

    // BV-BRC doesn't seem to have a logout endpoint
    // Just return success after clearing cookies
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { message: "Failed to logout" },
      { status: 500 }
    );
  }
}