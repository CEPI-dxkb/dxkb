import { NextResponse } from "next/server";
import { authAdmin } from "@/lib/auth/server/instance";

export async function POST() {
  try {
    const result = await authAdmin.sendVerificationEmail();

    if (result.error) {
      return NextResponse.json(
        { success: false, message: result.error.message },
        { status: result.error.status ?? 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification email sent successfully",
    });
  } catch (error) {
    console.error("Send verification email error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
