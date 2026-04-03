import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;
import { spawn } from "child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir, homedir } from "os";
import { join } from "path";
import { getProject, updateProject } from "@/lib/projects";
import { getAgent } from "@/lib/agents";
import { Message, AgentId, Project } from "@/lib/types";
import { randomUUID } from "crypto";

const BROKER_URL = process.env.CLAUDE_PEERS_BROKER_URL ?? "http://127.0.0.1:7899";

// ハルの確認依頼をclaude-peers CLIでClaude Codeに通知
// bun cli.ts send <peer-id> <message> を使う（from_id不要）
function notifyClaudeCode(projectId: string, agentId: AgentId, taskDescription: string): void {
  const CLAUDE_PEERS_DIR = join(homedir(), "claude-peers-mcp");

  // ブローカーからTTY付きの最新peerを探してメッセージ送信
  const script = `
import sys, urllib.request, json, subprocess, os

broker = "${BROKER_URL}"
req = urllib.request.Request(broker + "/list-peers", data=b"{}", method="POST",
  headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req, timeout=3) as r:
    peers = json.loads(r.read())

active = sorted([p for p in peers if p.get("tty")],
  key=lambda p: p["last_seen"], reverse=True)
if not active:
    sys.exit(0)

peer_id = active[0]["id"]
message = """【DevStudio 動作確認依頼】
プロジェクトID: ${projectId}
エージェントID: ${agentId}

""" + sys.argv[1] + """

確認完了後、以下のAPIに結果をPOSTしてください:
curl -s -X POST http://localhost:3000/api/agent-callback \\\\
  -H "Content-Type: application/json" \\\\
  -d '{"projectId":"${projectId}","agentId":${agentId},"result":"確認結果"}'
"""

subprocess.run(["bun", "cli.ts", "send", peer_id, message],
  cwd="${CLAUDE_PEERS_DIR}", check=False, capture_output=True)
`;

  const child = spawn("python3", ["-c", script, taskDescription], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin.end();
  child.on("error", () => {/* 無視 */});
}

interface ChatRequest {
  projectId: string;
  agentId: AgentId;
  message: string;
  imageBase64?: string;   // 添付画像（base64 data URL）
  activeSkills?: string[]; // ユーザーが選択したスキルID
}

// スキルファイルを読み込んでシステムプロンプトに注入する内容を返す
function loadSkillContent(skillId: string): string {
  const skillPath = join(homedir(), ".claude", "skills", skillId, "SKILL.md");
  if (!existsSync(skillPath)) return "";
  const raw = readFileSync(skillPath, "utf-8");
  // frontmatter を除去して返す
  return raw.replace(/^---[\s\S]*?---\n/, "").trim();
}

// エージェントにデフォルトで適用するスキルセット
const AGENT_DEFAULT_SKILLS: Partial<Record<AgentId, string[]>> = {
  1: ["blueprint"],                                                               // ルカ: 要件定義・アーキテクチャ
  2: ["landing-page-design", "frontend-patterns", "design-system"],              // レン: UI/画面設計
  3: ["vercel-react-best-practices", "nextjs-turbopack", "api-design", "database-migrations"], // コウ: 実装
  4: ["webapp-testing", "verification-loop", "bug-fixer"],                       // ミオ: QA・バグ修正
  5: ["deploy-to-vercel", "security-review"],                                    // ハル: 最終チェック
  6: ["bug-fixer", "improvement-advisor"],                                       // カイ: 修正・改善
};

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

    let body: string;
    if (s.summary) {
      // フェーズ完了時にAIが生成した構造化サマリーをそのまま渡す
      body = s.summary;
    } else {
      // サマリー未生成（進行中）の場合は生の会話を渡す
      body = s.messages
        .map((m) => `  ${m.role === "user" ? "ユーザー" : agent.name}: ${m.content}`)
        .join("\n");
    }

    // ミオ（agentId=4）にコウのCodexレビュー結果を渡す
    if (s.agentId === 3 && s.codexReview && currentAgentId === 4) {
      body += `\n\n【Codex自動コードレビュー（qwen3-coder:30b）】\n${s.codexReview}`;
    }

    return `${header}\n${body}`;
  });

  return `\n【これまでの会話履歴】\n${lines.join("\n\n")}\n`;
}

function buildSystemPrompt(agentId: AgentId, projectContext: string, previousContext: string, skillsContext?: string): string {
  const agent = getAgent(agentId);
  return `あなたは「${agent.name}」というキャラクターです。
役割: ${agent.role}
性格: ${agent.personality}
説明: ${agent.description}

【プロジェクト情報】
${projectContext}
${previousContext}
【ツール・権限について（重要）】
- この環境ではファイル読み書き・コード実行・bash・curlが使用可能
- UIのクリック・スクリーンショット等のブラウザ操作は自分では直接実行できない
- ただし APIエンドポイントの疎通確認は必ず curl で実行すること（コード確認だけで済ませない）

【動作確認・原因調査フェーズの必須ルール（最重要）】
コードを読むだけで「問題なさそう」と判断してはならない。
必ず以下の手順を踏むこと：

ステップ1: API疎通をcurlで実機確認する
  例: curl -s http://localhost:3000/api/receipts | head -c 200

ステップ2: UIの実機確認が必要な場合は、以下の形式で「ブラウザ確認依頼」を出力する
  ＜ブラウザ確認依頼＞
  確認URL: http://localhost:3000/receipts
  確認内容:
  1. （具体的な操作：例「撮影ボタンを押してカメラが起動するか確認」）
  2. （期待される結果：例「OCR結果が3秒以内に表示される」）
  3. （エラーが出た場合の確認箇所：例「コンソールのエラーメッセージを確認」）
  ＜/ブラウザ確認依頼＞
  ※ この依頼を受けたら、ユーザーはClaude Codeのコンピューターユーズで実際に操作確認を実施する

ステップ3: 確認結果をもとに問題を特定し、修正またはOKを報告する

「コードを見た限り問題ないと思います」は禁止。実機で再現するまで調査を続けること。

【会話の進め方（最重要）】
- ${agent.name}として話す。性格の口調・語尾・リアクションを忠実に再現すること
- ユーザーの言葉をいったん受け止めてから話す。否定・反論・説教は絶対にしない
- 毎回同じ書き出しにしない。「なるほど」「そうですね」「了解です」などの定型句で始めない
- 返答は短め・テンポよく。長文説明より会話のキャッチボールを優先する
- 回答はプレーンテキストのみ（**太字**などMarkdown記法は使わない）
- 重要な確認・提案は積極的に自分から言う
- このフェーズで話すべき内容が十分に固まったと判断したら、キャラらしい言い方で次のフェーズへの引き継ぎを提案する（例: ソラなら「じゃあ次いこっか！」、ルカなら「もう十分だと思う！次に進もう！」、ハルなら「ここまで来たら十分だと思う。次に進もうか」）
- あなたがコウ（実装担当）の場合、実装がすべて完了したら、以下のセットアップ手順をチャット内にすべてそのまま記載して案内すること。手順を省略したり「詳細は別途」などと言ったりしてはならない。
- あなたがハル（最終チェック・動作確認担当）の場合、プロジェクトが引き継がれた時点で即座に以下の手順でE2Eテストを自律実行すること：
  【ハルのE2E自動テスト手順（実機確認必須）】
  フェーズ1: API疎通確認（curl で実行）
    - GET /api/receipts など主要エンドポイントにcurlでリクエストを送り、レスポンスを確認する
    - 認証エラー・500エラーがないか確認する
    - 結果を「✅ 正常」「❌ エラー: (内容)」の形式で報告する

  フェーズ2: UIの実機確認依頼を出力する（ブラウザ確認依頼フォーマットで）
    - ログイン画面の表示と認証動作
    - 主要機能ページの表示（領収書一覧・撮影画面など）
    - データ保存・削除の動作
    - エラー時の表示（空状態・失敗メッセージなど）
    ※ 各確認項目を「＜ブラウザ確認依頼＞」フォーマットで出力し、コンピューターユーズでの実施を依頼する

  フェーズ3: 確認結果を受け取り、問題を分析して報告する
    - OKだった項目・NGだった項目を整理する
    - NGがあれば根本原因を調査し、修正案を提示する
    - すべてOKの場合のみ「動作確認完了」を宣言する
    - 完了後：「すべての確認が完了しました！画面下の緑の『Vercelにデプロイ』ボタンを押してください。デプロイが完了すると公開URLが表示されます。そのURLからどこからでもアクセスできます。」

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

すべて完了したら、画面下の「コウのフェーズを完了して次のエージェントへ」ボタンを押してください。ボタンを押すと自動で Vercel にデプロイされます。${skillsContext ? `\n\n【適用スキル・ベストプラクティス】\n${skillsContext}` : ""}`;

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

// 会話用: Haiku（高速・テキスト応答）
async function callClaudeChat(systemPrompt: string, userMessage: string, imagePath?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ["-p", "--output-format", "text", "--model", "haiku", "--permission-mode", "bypassPermissions", "--system-prompt", systemPrompt];
    if (imagePath) args.push("--image", imagePath);
    args.push(userMessage);
    const child = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdin.end();

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("タイムアウト: Claudeの応答が3分を超えました"));
    }, 180000);

    child.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0 && stdout.trim() === "") {
        const detail = stderr.trim() ? `: ${stderr.trim().slice(0, 200)}` : "";
        reject(new Error(`Claude が終了しました (code ${code})${detail}`));
      } else {
        resolve(stdout.trim());
      }
    });
    child.on("error", (err) => { clearTimeout(timeout); reject(err); });
  });
}

// コーディング用: bypassPermissions・ファイル操作あり（コウ専用）
async function callClaudeCode(systemPrompt: string, userMessage: string, imagePath?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ["-p", "--output-format", "text", "--model", "sonnet", "--permission-mode", "bypassPermissions", "--system-prompt", systemPrompt];
    if (imagePath) args.push("--image", imagePath);
    args.push(userMessage);
    const child = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdin.end();

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("タイムアウト: Claude の応答が10分を超えました"));
    }, 600000);

    child.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0 && stdout.trim() === "") {
        const detail = stderr.trim() ? `: ${stderr.trim().slice(0, 200)}` : "";
        reject(new Error(`Claude が終了しました (code ${code})${detail}`));
      } else {
        resolve(stdout.trim());
      }
    });
    child.on("error", (err) => { clearTimeout(timeout); reject(err); });
  });
}

// メッセージがコーディングタスクかどうかを判定（追加LLM呼び出しなし）
function detectCodeTask(message: string): boolean {
  const codeSignals = [
    "実装", "コードを書", "作って", "修正して", "直して", "追加して", "削除して",
    "ファイルを", "関数を", "コンポーネントを", "クラスを", "バグを",
    "エラーを修正", "デバッグ", "リファクタ",
    "```", "function ", "const ", "import ", ".ts", ".tsx", ".js", ".css",
    "implement", "create", "fix", "refactor", "write",
    // ツール操作が必要なタスク（Sonnetで実行）
    "スクリーンショット", "QRコード", "ブラウザで", "画面を開", "アクセスして",
    "テストして", "確認して", "デプロイ", "npm ", "curl ", "ログを",
  ];
  return codeSignals.some(s => message.includes(s));
}

// 応答にコードブロックが含まれているか判定
function containsCode(text: string): boolean {
  return text.includes("```");
}

// Codex + Ollama でコードをバックグラウンドレビュー（コーディング応答後に自動起動）
function triggerCodexReview(projectId: string, agentId: AgentId, codeResponse: string, projectName: string): void {
  const tmpFile = join(tmpdir(), `codex_review_${Date.now()}.txt`);
  const reviewPrompt = `あなたはコードレビュアーです。以下の実装コードをレビューしてください。

【プロジェクト】${projectName}

【レビュー対象コード】
${codeResponse}

バグ・セキュリティ・パフォーマンス・改善点を日本語で簡潔に指摘してください。`;

  const child = spawn("codex", [
    "exec",
    "--oss",
    "--local-provider", "ollama",
    "--profile", "review",
    "--ephemeral",
    "--skip-git-repo-check",
    "-o", tmpFile,
    reviewPrompt,
  ], { stdio: ["pipe", "pipe", "pipe"] });

  child.stdin.end();

  const timeout = setTimeout(() => child.kill(), 300000);

  child.on("close", () => {
    clearTimeout(timeout);
    try {
      const review = readFileSync(tmpFile, "utf-8").trim();
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
      if (!review) return;

      const latest = getProject(projectId);
      if (!latest) return;
      const sessions = latest.sessions.map((s) =>
        s.agentId === agentId ? { ...s, codexReview: review } : s
      );
      updateProject(projectId, { sessions });
    } catch { /* ignore */ }
  });

  child.on("error", () => clearTimeout(timeout));
}

async function callCodex(systemPrompt: string, userMessage: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tmpFile = join(tmpdir(), `codex_out_${Date.now()}.txt`);
    const combinedPrompt = `${systemPrompt}\n\n---\n\n${userMessage}`;

    const child = spawn("codex", [
      "exec",
      "--oss",
      "--local-provider", "ollama",
      "--profile", "review",
      "--ephemeral",
      "--skip-git-repo-check",
      "-o", tmpFile,
      combinedPrompt,
    ], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdin.end();

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("タイムアウト: Codexの応答が10分を超えました"));
    }, 600000);

    child.on("close", (code) => {
      clearTimeout(timeout);
      try {
        const output = readFileSync(tmpFile, "utf-8").trim();
        try { unlinkSync(tmpFile); } catch { /* ignore */ }
        if (output) {
          resolve(output);
        } else {
          reject(new Error(`Codexが終了しました (code ${code})`));
        }
      } catch {
        reject(new Error("Codexの出力を読み取れませんでした"));
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
    const { projectId, agentId, message, imageBase64, activeSkills } = await req.json() as ChatRequest;

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

    // スキル自動注入: デフォルト + ユーザー選択スキルをシステムプロンプトに追加
    const defaultSkills = AGENT_DEFAULT_SKILLS[agentId] ?? [];
    const allSkillIds = [...new Set([...defaultSkills, ...(activeSkills ?? [])])];
    const skillsContext = allSkillIds.map(loadSkillContent).filter(Boolean).join("\n\n---\n\n") || undefined;

    const systemPrompt = buildSystemPrompt(agentId, projectContext, previousContext, skillsContext);
    const userMsg2 = buildUserMessage(agentId, session.messages, message);

    // 添付画像を一時ファイルに保存
    let imagePath: string | undefined;
    if (imageBase64) {
      const [header, base64Data] = imageBase64.split(",");
      const mimeType = header.match(/:(.*?);/)?.[1] ?? "image/png";
      const ext = mimeType.split("/")[1] ?? "png";
      imagePath = join(tmpdir(), `devstudio_img_${Date.now()}.${ext}`);
      writeFileSync(imagePath, Buffer.from(base64Data, "base64"));
    }

    // AIによるモード自動判定:
    // コウ（3）              → 常にClaude Code（bypassPermissions・ファイル操作）
    // その他 + コーディング  → Claude Code（読み取り・推論のみ）
    // その他 + 会話          → Haiku（超高速）
    let reply: string;
    try {
      if (agentId === 3 || detectCodeTask(userMsg2)) {
        reply = await callClaudeCode(systemPrompt, userMsg2, imagePath);
      } else {
        reply = await callClaudeChat(systemPrompt, userMsg2, imagePath);
      }
    } finally {
      // 一時画像ファイルを削除
      if (imagePath) { try { unlinkSync(imagePath); } catch { /* ignore */ } }
    }

    // コードが含まれる応答 → Codex + Ollama でバックグラウンドレビュー自動起動
    if (containsCode(reply)) {
      triggerCodexReview(projectId, agentId, reply, project.name);
    }

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

    // Claude呼び出し中（最大7分）に他のリクエストがprojects.jsonを書き換えている場合があるため、
    // 保存前に最新のプロジェクト状態を再取得して、そこに新メッセージを追加する
    const freshProject = getProject(projectId);
    const freshSessions = freshProject ? freshProject.sessions : project.sessions;
    const freshSessionIdx = freshSessions.findIndex((s) => s.agentId === agentId);
    const targetIdx = freshSessionIdx !== -1 ? freshSessionIdx : sessionIdx;

    const updatedSessions = freshSessions.map((s, i) =>
      i === targetIdx
        ? { ...s, messages: [...s.messages, userMsg, assistantMsg] }
        : s
    );

    updateProject(projectId, { sessions: updatedSessions });

    // ブラウザ確認依頼が含まれていたらClaude Codeに非同期で通知
    if (reply.includes("＜ブラウザ確認依頼＞")) {
      void notifyClaudeCode(projectId, agentId, reply);
    }

    // 表示用に imageUrl を含めて返す（DBには保存しない）
    const userMsgForDisplay: Message = imageBase64
      ? { ...userMsg, imageUrl: imageBase64 }
      : userMsg;

    return NextResponse.json({
      success: true,
      data: { userMsg: userMsgForDisplay, assistantMsg },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
