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
- あなたがコウ（実装担当）の場合、実装がすべて完了したら、以下のセットアップ手順をチャット内にすべてそのまま記載して案内すること。手順を省略したり「詳細は別途」などと言ったりしてはならない。
- あなたがハル（最終チェック担当）の場合、チェックが完了したら以下の文言を必ずそのまま伝えること：「すべての確認が完了しました！画面下の緑の『Vercelにデプロイ』ボタンを押してください。デプロイが完了すると公開URLが表示されます。そのURLからどこからでもアクセスできます。」

【コウ実装完了時に必ずチャットに出力するセットアップ手順】
実装完了を伝えた後、以下の内容をそのまま（プロジェクト内容に合わせて微調整してよいが、各ステップの細かさは維持すること）出力すること：

動かすために、以下の手順を上から順番に行ってください。

■ STEP 1：Supabase にログインする
1. https://supabase.com/dashboard をブラウザで開く
2. アカウントがない場合は「Start your project」→「Sign Up」でアカウント作成（GitHub ログインが簡単）
3. ログインすると「All Projects」画面が表示される

■ STEP 2：新しいプロジェクトを作成する
1. 画面左上の緑色「New project」ボタンをクリック
2. Organization はデフォルト（Personal）のまま次へ
3. Project name に好きな名前を英数字で入力（例：my-app）
4. Database Password に安全なパスワードを入力してどこかにメモしておく
5. Region は「Northeast Asia (Tokyo)」を選択
6. 「Create new project」をクリック
7. 「Setting up your project...」が表示されるので 1〜2分待つ。「Welcome to your new project」が出たら完了

■ STEP 3：データベースのテーブルを作成する
1. Finder で ホーム → claude_setup → devstudio フォルダを開き「supabase-schema.sql」をテキストエディタで開く
2. ファイルの中身を全部選択（Command + A）してコピー（Command + C）
3. Supabase ダッシュボードの左サイドバーにある「<>」アイコン（SQL Editor）をクリック
4. 画面中央の入力エリア（「Write a query...」と書いてある場所）をクリック
5. 全選択（Command + A）してから貼り付け（Command + V）
6. 右下の緑色「Run」ボタンをクリック（または Command + Enter）
7. 画面下部に「Success. No rows returned」と出れば完了

■ STEP 4：画像保存用バケットを作成する
1. 左サイドバーの「Storage」（バケツアイコン）をクリック
2. 「New bucket」ボタンをクリック
3. バケット名に「receipt-images」と入力
4. 「Public bucket」のトグルは必ず OFF のまま
5. 「Save」をクリック。リストに「receipt-images」が出れば完了

■ STEP 5：接続情報（URL と API Key）を取得する
1. 左サイドバー一番下の「Settings」（歯車アイコン）をクリック
2. 左メニューの「API」をクリック
3. 「Project URL」右の「Copy」ボタンをクリック → メモしておく（NEXT_PUBLIC_SUPABASE_URL に使う）
4. 少し下にスクロールして「Project API keys」の「anon」行の「Copy」をクリック → メモしておく（NEXT_PUBLIC_SUPABASE_ANON_KEY に使う）

■ STEP 6：設定ファイル（.env.local）に書き込む
1. Finder を開き、Command + Shift + .（ピリオド）を押して隠しファイルを表示する
2. ホーム → claude_setup → devstudio 内の「.env.local」を右クリック → 「このアプリケーションで開く」→「テキストエディット」
3. NEXT_PUBLIC_SUPABASE_URL= の右側に STEP 5 でコピーした URL を貼り付ける
4. NEXT_PUBLIC_SUPABASE_ANON_KEY= の右側に STEP 5 でコピーした anon キーを貼り付ける
5. Command + S で保存して閉じる

■ STEP 7：ログイン用アカウントを作る
1. Supabase ダッシュボードの左サイドバーで「Authentication」（人型アイコン）→「Users」タブを開く
2. 右上「Add user」→「Create new user」をクリック
3. メールアドレス（例：me@example.com）とパスワードを入力して「Create user」
4. リストにユーザーが追加されれば完了

■ STEP 8：アプリを起動してログインする
1. ターミナルを開き（Dock の黒いアイコン）以下のコマンドを実行：cd ~/claude_setup/devstudio && npm run dev --webpack
2. 「Ready in ...ms」と表示されたら起動完了
3. ブラウザで http://localhost:3000/auth/login を開く
4. STEP 7 で作ったメールとパスワードでログイン

すべて完了したら、画面下の「コウのフェーズを完了して次のエージェントへ」ボタンを押してください。ボタンを押すと自動で Vercel にデプロイされます。`;

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
