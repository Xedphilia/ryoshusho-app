import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const maxDuration = 300;

function runCommand(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, env: { ...process.env, PATH: process.env.PATH + ":/opt/homebrew/bin" } });
    let out = "";
    let err = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { err += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(err || out));
    });
  });
}

export async function POST(_request: NextRequest) {
  const projectDir = path.join(process.cwd());

  try {
    // git状態確認
    let hasRemote = false;
    try {
      await runCommand("git", ["remote", "get-url", "origin"], projectDir);
      hasRemote = true;
    } catch {
      hasRemote = false;
    }

    // gitコミット＆push
    if (hasRemote) {
      try {
        await runCommand("git", ["add", "."], projectDir);
        await runCommand("git", ["commit", "-m", "deploy: Vercelデプロイ"], projectDir);
      } catch {
        // 変更なしの場合は無視
      }
      await runCommand("git", ["push", "origin", "main"], projectDir);
    }

    // vercel deploy
    const output = await runCommand("vercel", ["deploy", "--prod", "-y"], projectDir);

    // URLを抽出
    const urlMatch = output.match(/https:\/\/[^\s]+\.vercel\.app/);
    const deployUrl = urlMatch ? urlMatch[0] : null;

    if (!deployUrl) {
      return NextResponse.json({ success: false, error: "デプロイURLを取得できませんでした", output }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: deployUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
