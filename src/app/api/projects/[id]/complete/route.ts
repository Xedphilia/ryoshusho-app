import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;
import { spawn } from "child_process";
import { getProject, updateProject } from "@/lib/projects";
import { getAgent } from "@/lib/agents";
import { AgentId, AgentSession } from "@/lib/types";

interface CompleteRequest {
  agentId: AgentId;
}

async function generateSummary(session: AgentSession): Promise<string> {
  const agent = getAgent(session.agentId);
  const convo = session.messages
    .map((m) => `${m.role === "user" ? "ユーザー" : agent.name}: ${m.content}`)
    .join("\n");

  const prompt = `以下は「${agent.name}（${agent.role}）」とユーザーの会話です。
次のエージェントに引き継ぐため、この会話を以下の形式でまとめてください。

## ユーザーの課題・要望
（ユーザーが何を作りたいか、どんな悩みや要件があったかを箇条書きで）

## 提案と決定事項
（${agent.name}が何を提案し、ユーザーがどう反応・決定したかを箇条書きで）

## 次のフェーズへの申し送り
（次の担当者が押さえておくべきポイントを簡潔に）

---会話---
${convo}`;

  return new Promise((resolve) => {
    const child = spawn("claude", [
      "-p",
      "--output-format", "text",
      "--model", "sonnet",
      prompt,
    ], { stdio: ["pipe", "pipe", "pipe"] });

    child.stdin.end();

    let stdout = "";
    const timeout = setTimeout(() => {
      child.kill();
      resolve("（サマリー生成タイムアウト）");
    }, 60000);

    child.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
    child.on("close", () => {
      clearTimeout(timeout);
      resolve(stdout.trim() || "（サマリー生成失敗）");
    });
    child.on("error", () => {
      clearTimeout(timeout);
      resolve("（サマリー生成エラー）");
    });
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { agentId } = await req.json() as CompleteRequest;

    const project = getProject(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: "プロジェクトが見つかりません" },
        { status: 404 }
      );
    }

    const currentSession = project.sessions.find((s) => s.agentId === agentId);
    if (!currentSession) {
      return NextResponse.json(
        { success: false, error: "セッションが見つかりません" },
        { status: 404 }
      );
    }

    // セッションをすぐ完了扱いにして即レスポンス
    const nextAgent = agentId < 5 ? ((agentId + 1) as AgentId) : agentId;
    const updatedSessions = project.sessions.map((s) =>
      s.agentId === agentId ? { ...s, completed: true } : s
    );
    const updated = updateProject(id, {
      sessions: updatedSessions,
      currentAgent: nextAgent,
    });

    // サマリー生成はバックグラウンドで実行（レスポンスをブロックしない）
    void generateSummary(currentSession).then((summary) => {
      const latest = getProject(id);
      if (!latest) return;
      const sessions = latest.sessions.map((s) =>
        s.agentId === agentId ? { ...s, summary } : s
      );
      updateProject(id, { sessions });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
