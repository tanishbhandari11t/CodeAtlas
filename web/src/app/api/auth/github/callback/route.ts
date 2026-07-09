import { NextRequest, NextResponse } from "next/server";
import {
  fetchGitHubUser,
  getAppUrl,
  getGitHubOAuthConfig,
  GITHUB_TOKEN_COOKIE,
  GITHUB_USER_COOKIE,
  OAUTH_STATE_COOKIE,
} from "@/lib/github-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const config = getGitHubOAuthConfig();
  const appUrl = getAppUrl();
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const err = req.nextUrl.searchParams.get("error");
  const savedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (err) {
    return NextResponse.redirect(
      `${appUrl}/import?mode=github&error=${encodeURIComponent(err)}`
    );
  }

  if (!config.configured) {
    return NextResponse.redirect(
      `${appUrl}/import?mode=github&error=${encodeURIComponent(
        "oauth_not_configured"
      )}`
    );
  }

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(
      `${appUrl}/import?mode=github&error=${encodeURIComponent(
        "invalid_oauth_state"
      )}`
    );
  }

  try {
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.redirectUri,
        }),
      }
    );
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenJson.access_token) {
      throw new Error(
        tokenJson.error_description ||
          tokenJson.error ||
          "No access token returned"
      );
    }

    const token = tokenJson.access_token;
    const user = await fetchGitHubUser(token);

    const res = NextResponse.redirect(`${appUrl}/import?mode=github&connected=1`);
    const secure = process.env.NODE_ENV === "production";
    const maxAge = 60 * 60 * 24 * 14; // 14 days

    res.cookies.set(GITHUB_TOKEN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge,
    });
    res.cookies.set(
      GITHUB_USER_COOKIE,
      encodeURIComponent(JSON.stringify(user)),
      {
        httpOnly: false,
        sameSite: "lax",
        secure,
        path: "/",
        maxAge,
      }
    );
    res.cookies.set(OAUTH_STATE_COOKIE, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "oauth_failed";
    return NextResponse.redirect(
      `${appUrl}/import?mode=github&error=${encodeURIComponent(message)}`
    );
  }
}
