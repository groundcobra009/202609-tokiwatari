import { NextResponse } from "next/server";
import { themeForDate } from "@/lib/themes";

export async function GET(req: Request) {
  try {
    return NextResponse.json(themeForDate(new URL(req.url).searchParams.get("date") ?? undefined), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
