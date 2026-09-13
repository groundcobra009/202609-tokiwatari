import { NextResponse } from "next/server";
import { withIdentity } from "@/lib/auth";
export const GET = withIdentity(async (_req, user) => NextResponse.json(user));
