import { NextResponse } from "next/server";
import {
  GITHUB_TOKEN_COOKIE,
  GITHUB_USER_COOKIE,
  OAUTH_STATE_COOKIE,
} from "@/lib/github-auth";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  for (const name of [
    GITHUB_TOKEN_COOKIE,
    GITHUB_USER_COOKIE,
    OAUTH_STATE_COOKIE,
  ]) {
    res.cookies.set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
  }
  return res;
}
