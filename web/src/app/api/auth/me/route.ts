import { NextResponse } from "next/server";
import {
  getGitHubOAuthConfig,
  getGitHubToken,
  getGitHubUserFromCookie,
  fetchGitHubUser,
} from "@/lib/github-auth";

export const runtime = "nodejs";

export async function GET() {
  const config = getGitHubOAuthConfig();
  const token = await getGitHubToken();
  if (!token) {
    return NextResponse.json({
      configured: config.configured,
      authenticated: false,
      user: null,
    });
  }

  try {
    const cached = await getGitHubUserFromCookie();
    const user = cached || (await fetchGitHubUser(token));
    return NextResponse.json({
      configured: config.configured,
      authenticated: true,
      user,
    });
  } catch {
    return NextResponse.json({
      configured: config.configured,
      authenticated: false,
      user: null,
    });
  }
}
