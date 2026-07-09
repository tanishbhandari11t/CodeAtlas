import { NextRequest, NextResponse } from "next/server";
import {
  analyzeGitHubRepo,
  analyzeZipBuffer,
  parseGitHubRepo,
} from "@/lib/analyze-repo";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // ZIP upload
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { error: "Upload a .zip file" },
          { status: 400 }
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.length > 80 * 1024 * 1024) {
        return NextResponse.json(
          { error: "ZIP too large (max 80MB for this demo)" },
          { status: 400 }
        );
      }
      const graph = await analyzeZipBuffer(buf, file.name);
      return NextResponse.json({ graph });
    }

    const body = await req.json();
    const repo = String(body.repo || "").trim();
    if (!repo) {
      return NextResponse.json(
        { error: "Provide a repository as owner/name or GitHub URL" },
        { status: 400 }
      );
    }

    const parsed = parseGitHubRepo(repo);
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            "Invalid repository. Use owner/name (e.g. facebook/react) or a full GitHub URL.",
        },
        { status: 400 }
      );
    }

    const graph = await analyzeGitHubRepo(`${parsed.owner}/${parsed.name}`);
    return NextResponse.json({ graph });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    console.error("[analyze]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
