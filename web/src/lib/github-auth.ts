import { cookies } from "next/headers";

export const GITHUB_TOKEN_COOKIE = "codeatlas_gh_token";
export const GITHUB_USER_COOKIE = "codeatlas_gh_user";
export const OAUTH_STATE_COOKIE = "codeatlas_oauth_state";

export function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function getGitHubOAuthConfig() {
  const clientId = process.env.GITHUB_CLIENT_ID || "";
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || "";
  return {
    clientId,
    clientSecret,
    configured: Boolean(clientId && clientSecret),
    redirectUri: `${getAppUrl()}/api/auth/github/callback`,
    scope: "read:user repo",
  };
}

export async function getGitHubToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(GITHUB_TOKEN_COOKIE)?.value || null;
}

export type GitHubUser = {
  login: string;
  name: string | null;
  avatar_url: string;
};

export async function getGitHubUserFromCookie(): Promise<GitHubUser | null> {
  const jar = await cookies();
  const raw = jar.get(GITHUB_USER_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as GitHubUser;
  } catch {
    return null;
  }
}

export type GitHubRepo = {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  language: string | null;
  description: string | null;
  updated_at: string;
  html_url: string;
};

export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "CodeAtlas",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GitHub user lookup failed (${res.status})`);
  }
  const data = (await res.json()) as {
    login: string;
    name: string | null;
    avatar_url: string;
  };
  return {
    login: data.login,
    name: data.name,
    avatar_url: data.avatar_url,
  };
}

export async function fetchUserRepos(
  token: string,
  page = 1,
  perPage = 30
): Promise<GitHubRepo[]> {
  const url = new URL("https://api.github.com/user/repos");
  url.searchParams.set("sort", "updated");
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));
  url.searchParams.set("affiliation", "owner,collaborator,organization_member");

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "CodeAtlas",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Could not list repos (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as Array<{
    id: number;
    full_name: string;
    name: string;
    private: boolean;
    language: string | null;
    description: string | null;
    updated_at: string;
    html_url: string;
  }>;
  return data.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    name: r.name,
    private: r.private,
    language: r.language,
    description: r.description,
    updated_at: r.updated_at,
    html_url: r.html_url,
  }));
}
