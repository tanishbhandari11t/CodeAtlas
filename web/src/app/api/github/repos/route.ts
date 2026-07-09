import { NextRequest, NextResponse } from "next/server";
import { fetchUserRepos, getGitHubToken } from "@/lib/github-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = await getGitHubToken();
  if (!token) {
    return NextResponse.json(
      { error: "Not signed in with GitHub", authenticated: false },
      { status: 401 }
    );
  }

  const page = Number(req.nextUrl.searchParams.get("page") || "1");
  try {
    const repos = await fetchUserRepos(token, page, 40);
    return NextResponse.json({ authenticated: true, repos });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list repos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
