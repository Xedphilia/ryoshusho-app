import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;
import { spawn } from "child_process";
import { getProject, updateProject } from "@/lib/projects";
import { getAgent } from "@/lib/agents";
import { Message, AgentId, Project } from "@/lib/types";
import { randomUUID } from "crypto";

interface ChatRequest {
  projectId: string;
  agentId: AgentId;
  message: string;
}

function buildPreviousContext(project: Project, currentAgentId: AgentId): string {
  // ソラ（0）とカイ（6）は全セッションを見渡す。それ以外は自分より前のエージェントのみ。
  const targetSessions = project.sessions.filter((s) => {
    if (s.messages.length === 0 && !s.summary) return false;
    if (currentAgentId === 0) return s.agentId !== 0;
    if (currentAgentId === 6) return s.agentId !== 6;
    return s.agentId > 0 && s.agentId < currentAgentId;
  });

  if (targetSessions.length === 0) return "";

  const lines = targetSessions.map((s) => {
    const agent = getAgent(s.agentId);
    const statusLabel = s.completed ? "完了" : "進行中";
    const header = `【${agent.name}（${agent.role}） / ${statusLabel}】`;

    if (s.summary) {
      // フェーズ完了時にAIが生成した構造化サマリーをそのまま渡す
      return `${header}\n${s.summary}`;
    }

    // サマリー未生成（進行中）の場合は生の会話を渡す
    const convo = s.messages
      .map((m) => `  ${m.role === "user" ? "ユーザー" : agent.name}: ${m.content}`)
      .join("\n");
    return `${header}\n${convo}`;
  });

  return `\n【これまでの会話履歴】\n${lines.join("\n\n")}\n`;
}

function buildSystemPrompt(agentId: AgentId, projectContext: string, previousContext: string): string {
  const agent = getAgent(agentId);
  return `あなたは「${agent.name}」というキャラクターです。
役割: ${agent.role}
性格: ${agent.personality}
説明: ${agent.description}

【プロジェクト情報】
${projectContext}
${previousContext}
【会話の進め方】
- ${agent.name}として自然な日本語で話す。敬語かタメ口かは性格に合わせる
- 相手の発言に対して素直に反応してから、必要なことを聞く
- 毎回同じ言葉や褒め方で始めない（「なるほど！」「それいいね！」「すごい！」などの定型反応を繰り返さない）
- 返答の書き出しは毎回変える。違う角度から自然に始める
- 回答はプレーンテキストのみ（**太字**などMarkdown記法は使わない）
- 重要な確認事項や提案は積極的に伝える
- このフェーズで話すべき内容が十分に固まったと判断したら、「内容が固まりましたね。次のフェーズに引き継ぎます。よろしければ次に進みましょう」のように次のエージェントへの引き継ぎを提案する

【初心者向け説明の大原則（必ず守ること）】
相手はプログラミング初心者。「なんとなく分かる」は失敗。「迷わず操作できる」が成功の基準。

【手順・操作を説明するときのルール】
- 手順は必ず「1.」「2.」「3.」などの番号付きリストで書く（矢印「→」で繋げない）
- 各ステップには「どこを見て・何をクリックして・何が起きるか」を1セットで書く
  - 悪い例：「SQL Editorでスキーマを実行する」
  - 良い例：「1. 画面左のサイドバーにある「<>」マークのアイコンをクリックすると SQL Editor が開く。2. 上の入力欄に supabase-schema.sql の中身を全部コピペする。3. 右上の緑の「Run」ボタンを押す。緑の「Success」が出れば完了」
- 外部サービスを案内するときは、フルURL（例: https://supabase.com/dashboard）を必ず書く。「Supabaseダッシュボード」とだけ書かない
- 新しいプロジェクト作成・アカウント登録など事前準備が必要なときは、その手順も省略せず書く
- ターミナルで実行するコマンドは「ターミナルで実行:」と前置きしてどのフォルダで実行するかも書く
- 設定ファイル（.env.local等）の編集は「テキストエディタでファイルを開いて〇行目を書き換える」と具体的に書く
- ブラウザでアクセスするURLはそのまま書く（バックティックで囲まない）。例: http://localhost:3000/auth/login
- 「あとは同じように」「適宜設定してください」などの曖昧な表現は使わない`;
}

function buildUserMessage(agentId: AgentId, history: Message[], userMessage: string): string {
  const agent = getAgent(agentId);
  const historyText = history
    .slice(-8)
    .map((m) => `${m.role === "user" ? "ユーザー" : agent.name}: ${m.content}`)
    .join("\n");

  return historyText
    ? `【会話履歴】\n${historyText}\n\nユーザー: ${userMessage}`
    : `ユーザー: ${userMessage}`;
}

async function callClaudeCode(systemPrompt: string, userMessage: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", [
      "-p",
      "--output-format", "text",
      "--model", "sonnet",
      "--system-prompt", systemPrompt,
      userMessage,
    ], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // stdinを閉じてプロンプト待ちを防ぐ
    child.stdin.end();

    let stdout = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("タイムアウト: Claude の応答が10分を超えました"));
    }, 600000);

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0 && stdout.trim() === "") {
        reject(new Error(`Claude が終了しました (code ${code})`));
      } else {
        resolve(stdout.trim());
      }
    });
    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, agentId, message } = await req.json() as ChatRequest;

    let project = getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: "プロジェクトが見つかりません" },
        { status: 404 }
      );
    }

    let sessionIdx = project.sessions.findIndex((s) => s.agentId === agentId);
    // 古いプロジェクトにセッションがない場合はオンザフライで追加
    if (sessionIdx === -1) {
      const newSession = { agentId, messages: [], completed: false };
      const sessions = [...project.sessions, newSession];
      updateProject(projectId, { sessions });
      project = { ...project, sessions };
      sessionIdx = sessions.length - 1;
    }

    const session = project.sessions[sessionIdx];
    const projectContext = `プロジェクト名: ${project.name}\n説明: ${project.description}`;
    const previousContext = buildPreviousContext(project, agentId);

    const systemPrompt = buildSystemPrompt(agentId, projectContext, previousContext);
    const userMsg2 = buildUserMessage(agentId, session.messages, message);
    const reply = await callClaudeCode(systemPrompt, userMsg2);

    const userMsg: Message = {
      id: randomUUID(),
      role: "user",
      content: message,
      timestamp: Date.now(),
    };
    const assistantMsg: Message = {
      id: randomUUID(),
      role: "assistant",
      content: reply,
      timestamp: Date.now(),
    };

    const updatedSessions = project.sessions.map((s, i) =>
      i === sessionIdx
        ? { ...s, messages: [...s.messages, userMsg, assistantMsg] }
        : s
    );

    updateProject(projectId, { sessions: updatedSessions });

    return NextResponse.json({
      success: true,
      data: { userMsg, assistantMsg },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
