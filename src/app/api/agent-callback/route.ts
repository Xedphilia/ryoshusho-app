import { NextRequest, NextResponse } from "next/server";
import { getProject, updateProject } from "@/lib/projects";
import { Message } from "@/lib/types";
import { randomUUID } from "crypto";

// POST /api/agent-callback
// Claude Codeがcomputer-use確認を完了したときにここに結果を書き戻す
export async function POST(req: NextRequest) {
  try {
    const { projectId, agentId, result } = await req.json() as {
      projectId: string;
      agentId: number;
      result: string;
    };

    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ success: false, error: "プロジェクトが見つかりません" }, { status: 404 });
    }

    const sessionIdx = project.sessions.findIndex((s) => s.agentId === agentId);
    if (sessionIdx === -1) {
      return NextResponse.json({ success: false, error: "セッションが見つかりません" }, { status: 404 });
    }

    const callbackMsg: Message = {
      id: randomUUID(),
      role: "assistant",
      content: `【Claude Code 動作確認結果】\n${result}`,
      timestamp: Date.now(),
    };

    const freshProject = getProject(projectId);
    const freshSessions = freshProject ? freshProject.sessions : project.sessions;
    const freshIdx = freshSessions.findIndex((s) => s.agentId === agentId);

    const updatedSessions = freshSessions.map((s, i) =>
      i === freshIdx
        ? { ...s, messages: [...s.messages, callbackMsg] }
        : s
    );

    updateProject(projectId, { sessions: updatedSessions });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
