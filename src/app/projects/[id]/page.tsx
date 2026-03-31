"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Send, ArrowLeft, CheckCircle2, ChevronRight, AlertCircle, ArrowRight } from "lucide-react";
import { Project, Message, AgentId } from "@/lib/types";
import { AGENTS, getAgent } from "@/lib/agents";
import AgentAvatar from "@/components/agents/AgentAvatar";
import { SetupGuideButton } from "@/components/SetupGuide";

// ---- メッセージレンダラー ----
// URL・太字・インラインコード・番号付きリストをパースして表示する

// サービス名 → URL の自動リンクマッピング
const SERVICE_LINKS: Array<{ pattern: RegExp; href: string; label: string }> = [
  { pattern: /Supabaseダッシュボード|Supabase ダッシュボード|Supabase Dashboard/g, href: "https://supabase.com/dashboard", label: "Supabase ダッシュボード" },
  { pattern: /SQL Editor/g, href: "https://supabase.com/dashboard", label: "SQL Editor" },
];

function renderInline(text: string, key: string): React.ReactNode[] {
  // **bold** と `code` と URL とサービス名を処理
  const servicePattern = SERVICE_LINKS.map(s => s.pattern.source).join("|");
  const fullPattern = new RegExp(`(\\*\\*[^*]+\\*\\*|\`[^\`]+\`|https?:\\/\\/[^\\s)]+|${servicePattern})`, "g");
  const parts = text.split(fullPattern);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${key}_b${i}`} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    // サービス名の自動リンク化
    const serviceMatch = SERVICE_LINKS.find(s => new RegExp(s.pattern.source).test(part));
    if (serviceMatch) {
      return (
        <a
          key={`${key}_s${i}`}
          href={serviceMatch.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline underline-offset-2 font-medium rounded px-1 transition-opacity hover:opacity-70"
          style={{ color: "#3B82F6", backgroundColor: "#EFF6FF" }}
          onClick={(e) => e.stopPropagation()}
        >
          ↗ {part}
        </a>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      const inner = part.slice(1, -1);
      // バックティック内がURLなら、コードではなくリンクとして表示
      if (/^https?:\/\//.test(inner)) {
        const isLocalhost = inner.includes("localhost");
        return (
          <a
            key={`${key}_cl${i}`}
            href={inner}
            target={isLocalhost ? "_self" : "_blank"}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2 font-medium rounded px-1 transition-opacity hover:opacity-70 font-mono text-xs"
            style={{ color: "#3B82F6", backgroundColor: "#EFF6FF" }}
            onClick={(e) => e.stopPropagation()}
          >
            {isLocalhost ? "🔗 " : "↗ "}{inner}
          </a>
        );
      }
      return (
        <code
          key={`${key}_c${i}`}
          className="px-1.5 py-0.5 rounded text-xs font-mono"
          style={{ backgroundColor: "#F0EDF8", color: "#6B4F9A" }}
        >
          {inner}
        </code>
      );
    }
    if (/^https?:\/\//.test(part)) {
      // プレースホルダーURLはリンク化しない（xxx, example, your- 等）
      const isPlaceholder = /\/(xxx|example|your-|<[^>]+>)/i.test(part) ||
        /^https?:\/\/(xxx|example)\./i.test(part);
      if (isPlaceholder) {
        return <span key={`${key}_t${i}`}>{part}</span>;
      }
      const isLocalhost = part.includes("localhost");
      return (
        <a
          key={`${key}_l${i}`}
          href={part}
          target={isLocalhost ? "_self" : "_blank"}
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline underline-offset-2 font-medium rounded px-1 transition-opacity hover:opacity-70"
          style={{ color: "#3B82F6", backgroundColor: "#EFF6FF" }}
          onClick={(e) => e.stopPropagation()}
        >
          {isLocalhost ? "🔗 " : "↗ "}{part}
        </a>
      );
    }
    return <span key={`${key}_t${i}`}>{part}</span>;
  });
}

function MessageContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // コードブロック (``` で始まる行)
    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // closing ``` をスキップ
      nodes.push(
        <pre
          key={`code_${i}`}
          className="rounded-lg p-3 my-1.5 text-xs font-mono overflow-x-auto leading-relaxed border"
          style={{ backgroundColor: "#F5F2FC", color: "#3D2B6B", borderColor: "#D8CCEF" }}
        >
          {codeLines.join("\n")}
        </pre>
      );
      continue;
    }

    // 空行
    if (line.trim() === "") {
      nodes.push(<div key={`gap_${i}`} className="h-1" />);
      i++;
      continue;
    }

    // 番号付きリスト (1. ...)
    if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)/)!;
      nodes.push(
        <div key={`li_${i}`} className="flex gap-2 items-start my-0.5">
          <span
            className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black mt-0.5"
            style={{ backgroundColor: "#E8D9F9", color: "#7B5BA8" }}
          >
            {match[1]}
          </span>
          <span>{renderInline(match[2], `li_${i}`)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 箇条書き (- ... or ・...)
    if (/^[-・]\s/.test(line)) {
      const text = line.replace(/^[-・]\s/, "");
      nodes.push(
        <div key={`bul_${i}`} className="flex gap-2 items-start my-0.5">
          <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#C4B5E8" }} />
          <span>{renderInline(text, `bul_${i}`)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 通常行
    nodes.push(
      <p key={`p_${i}`} className="leading-relaxed">
        {renderInline(line, `p_${i}`)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5 text-sm">{nodes}</div>;
}

// エージェントごとの進捗ステージ（秒数ベース）
const PROGRESS_STAGES: Record<number, Array<{ after: number; label: string }>> = {
  1: [ // ルカ — アイデア整理
    { after: 0,  label: "アイデアを受け取っています..." },
    { after: 8,  label: "要件を整理しています..." },
    { after: 20, label: "提案をまとめています..." },
    { after: 45, label: "返答を仕上げています..." },
  ],
  2: [ // レン — 設計
    { after: 0,  label: "設計内容を確認しています..." },
    { after: 10, label: "画面構成を検討しています..." },
    { after: 30, label: "仕様を詰めています..." },
    { after: 60, label: "整合性を確認しています..." },
  ],
  3: [ // コウ — 実装
    { after: 0,  label: "設計を読み込んでいます..." },
    { after: 10, label: "実装方針を決めています..." },
    { after: 30, label: "コードを書いています..." },
    { after: 70, label: "コードを整理しています..." },
    { after: 110, label: "最終チェックしています..." },
  ],
  4: [ // ミオ — QA
    { after: 0,  label: "テスト観点を考えています..." },
    { after: 12, label: "バグを探しています..." },
    { after: 30, label: "動作パターンを確認しています..." },
    { after: 55, label: "チェックリストを仕上げています..." },
  ],
  5: [ // ハル — レビュー
    { after: 0,  label: "全体を見渡しています..." },
    { after: 12, label: "評価ポイントを整理しています..." },
    { after: 30, label: "フィードバックをまとめています..." },
    { after: 55, label: "改善提案を書いています..." },
  ],
};

function getProgressLabel(agentId: number, elapsed: number): string {
  const stages = PROGRESS_STAGES[agentId] ?? [
    { after: 0,  label: "考えています..." },
    { after: 30, label: "回答をまとめています..." },
  ];
  return [...stages].reverse().find((s) => elapsed >= s.after)?.label ?? stages[0].label;
}

// AIレスポンスに含まれる「次に進む」トリガーフレーズ
const TRANSITION_PHRASES = [
  "次のフェーズ", "次のエージェント", "次に進み", "引き継ぎ", "移行します",
  "コウに", "ミオに", "レンに", "実装に移", "設計を渡", "次のステップへ",
  "問題なければ次", "よろしければ次",
];

function detectTransition(content: string): boolean {
  return TRANSITION_PHRASES.some((p) => content.includes(p));
}

// 「OK」などの肯定的な短文を検出
function isAffirmative(text: string): boolean {
  return /^(ok|okay|おk|オーケー|はい|yes|いい(よ|ね|です|！|!)?|進んで|どうぞ|お願い(します|！|!)?|了解|わかった|ゴー|go|大丈夫|よし|はーい|ありがとう).{0,15}$/i.test(text.trim());
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [activeAgent, setActiveAgent] = useState<AgentId>(1);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [sendingElapsed, setSendingElapsed] = useState(0);
  const [pendingTransition, setPendingTransition] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchProject = useCallback(async () => {
    const res = await fetch("/api/projects");
    const json = await res.json() as { success: boolean; data: Project[] };
    if (!json.success) return;
    const p = json.data.find((x) => x.id === id);
    if (!p) { router.push("/projects"); return; }
    return p;
  }, [id, router]);

  useEffect(() => {
    void fetchProject().then((p) => {
      if (!p) return;
      setProject(p);
      const initAgent = p.currentAgent;
      setActiveAgent(initAgent);
      const session = p.sessions.find((s) => s.agentId === initAgent);
      const msgs = session?.messages ?? [];
      setMessages(msgs.length === 0 ? [makeGreeting(initAgent)] : msgs);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function makeGreeting(agentId: AgentId): Message {
    return {
      id: `greeting_${agentId}_${Date.now()}`,
      role: "assistant",
      content: getAgent(agentId).greeting,
      timestamp: Date.now(),
    };
  }

  function switchAgent(agentId: AgentId, p: Project) {
    setActiveAgent(agentId);
    setError(null);
    setPendingTransition(false);
    const session = p.sessions.find((s) => s.agentId === agentId);
    const msgs = session?.messages ?? [];
    setMessages(msgs.length > 0 ? msgs : [makeGreeting(agentId)]);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, completing, pendingTransition]);

  async function handleCompleteStep() {
    if (!project || completing) return;
    setPendingTransition(false);
    setCompleting(true);
    setError(null);
    const wasKou = activeAgent === 3;
    try {
      const res = await fetch(`/api/projects/${project.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: activeAgent }),
      });
      const json = await res.json() as { success: boolean; data?: Project; error?: string };
      if (json.success && json.data) {
        const updated = json.data;
        setProject(updated);
        const next = activeAgent < 5 ? ((activeAgent + 1) as AgentId) : activeAgent;
        switchAgent(next, updated);
        // コウ（実装フェーズ）完了時に自動デプロイ
        if (wasKou) {
          setDeploying(true);
          setDeployError(null);
          try {
            const deployRes = await fetch("/api/deploy", { method: "POST" });
            const deployJson = await deployRes.json() as { success: boolean; url?: string; error?: string };
            if (deployJson.success && deployJson.url) {
              setDeployUrl(deployJson.url);
              setMessages((prev) => [
                ...prev,
                {
                  id: `deploy_${Date.now()}`,
                  role: "assistant",
                  content: `実装が完了しました！Vercelへのデプロイも完了しています。\nここで確認できます: ${deployJson.url}`,
                  timestamp: Date.now(),
                },
              ]);
            } else {
              setDeployError(deployJson.error ?? "デプロイに失敗しました");
            }
          } catch {
            setDeployError("デプロイ中にエラーが発生しました");
          }
          setDeploying(false);
        }
      } else {
        setError(json.error ?? "フェーズの完了に失敗しました");
      }
    } catch {
      setError("通信エラーが発生しました");
    }
    setCompleting(false);
  }

  async function handleSend() {
    if (!input.trim() || sending || !project) return;

    const userText = input.trim();

    // 移行承認の検出: AIが「次へ」と言った後にOKなら自動でフェーズ完了
    if (pendingTransition && isAffirmative(userText) && !isCompleted && activeAgent > 0) {
      setPendingTransition(false);
      setMessages((prev) => [...prev, {
        id: `ok_${Date.now()}`,
        role: "user",
        content: userText,
        timestamp: Date.now(),
      }]);
      setInput("");
      void handleCompleteStep();
      return;
    }

    setSending(true);
    setSendingElapsed(0);
    setError(null);
    setInput("");

    elapsedTimerRef.current = setInterval(() => {
      setSendingElapsed((prev) => prev + 1);
    }, 1000);

    const tempUser: Message = {
      id: `tmp_${Date.now()}`,
      role: "user",
      content: userText,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, tempUser]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, agentId: activeAgent, message: userText }),
      });
      const json = await res.json() as {
        success: boolean;
        data?: { userMsg: Message; assistantMsg: Message };
        error?: string;
      };

      if (json.success && json.data) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempUser.id),
          json.data!.userMsg,
          json.data!.assistantMsg,
        ]);
        const updated = await fetchProject();
        if (updated) setProject(updated);
        // AIが「次へ」を提案しているか検出
        if (
          activeAgent >= 1 && activeAgent <= 5 &&
          !(currentSession?.completed) &&
          detectTransition(json.data.assistantMsg.content)
        ) {
          setPendingTransition(true);
        }
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempUser.id));
        setError(json.error ?? "送信に失敗しました");
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempUser.id));
      setError("通信エラーが発生しました");
    }
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    setSending(false);
    setSendingElapsed(0);
  }

  async function handleDeploy() {
    setDeploying(true);
    setDeployError(null);
    try {
      const res = await fetch("/api/deploy", { method: "POST" });
      const json = await res.json() as { success: boolean; url?: string; error?: string };
      if (json.success && json.url) {
        setDeployUrl(json.url);
      } else {
        setDeployError(json.error ?? "デプロイに失敗しました");
      }
    } catch {
      setDeployError("通信エラーが発生しました");
    }
    setDeploying(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (isComposing) return;
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-primary)" }}>
        <AgentAvatar agentId={0} size={64} className="animate-bounce" />
      </div>
    );
  }

  const agent = getAgent(activeAgent);
  const currentSession = project.sessions.find((s) => s.agentId === activeAgent);
  const isCompleted = currentSession?.completed ?? false;
  const allPhasesCompleted = [1, 2, 3, 4, 5].every(
    (id) => project.sessions.some((s) => s.agentId === id && s.completed)
  );
  const hasEnoughMessages = messages.filter((m) => m.role === "user").length >= 2;

  // 進捗バーのステータステキスト
  const phaseNum = activeAgent >= 1 && activeAgent <= 5 ? activeAgent : null;
  const statusText = completing
    ? "引き継ぎ中..."
    : sending
      ? `${agent.name}が返答を作成中...`
      : pendingTransition
        ? "次のフェーズへ移行できます"
        : isCompleted
          ? "このフェーズは完了済み"
          : "会話中";
  const statusColor = completing || sending
    ? agent.color
    : pendingTransition
      ? "#22C55E"
      : isCompleted
        ? "#A0A0B0"
        : "#8B82A0";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* ドット背景 */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, rgba(155,126,200,0.12) 1.5px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* ヘッダー */}
      <header
        className="relative px-4 py-3 flex items-center gap-3"
        style={{
          background: `linear-gradient(135deg, ${agent.bgColor} 0%, white 100%)`,
          borderBottom: `2px solid ${agent.borderColor}`,
        }}
      >
        <Link
          href="/projects"
          className="p-2 rounded-full hover:opacity-70 transition-opacity shrink-0"
          style={{ backgroundColor: agent.bgColor, color: agent.color }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-sm truncate" style={{ color: "#3D3250" }}>
            {project.name}
          </h1>
          <p className="text-xs" style={{ color: "#8B82A0" }}>
            {project.description || "アプリ開発プロジェクト"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <SetupGuideButton />
          {[0, 6].map((aid) => {
            const a = AGENTS.find((x) => x.id === aid)!;
            return (
              <button
                key={aid}
                onClick={() => switchAgent(aid as AgentId, project)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                style={{
                  backgroundColor: activeAgent === aid ? a.color : a.bgColor,
                  color: activeAgent === aid ? "white" : a.color,
                  border: `1.5px solid ${a.borderColor}`,
                }}
              >
                <AgentAvatar agentId={aid} size={20} />
                {a.name}
              </button>
            );
          })}
        </div>
      </header>

      {/* フロー進行バー */}
      <div
        className="relative px-4 py-3 flex items-center gap-2 overflow-x-auto"
        style={{ backgroundColor: "white", borderBottom: "1.5px solid var(--border)" }}
      >
        {AGENTS.slice(1, 6).map((a, idx) => {
          const session = project.sessions.find((s) => s.agentId === a.id);
          const done = session?.completed ?? false;
          const current = activeAgent === a.id;
          return (
            <div key={a.id} className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => switchAgent(a.id as AgentId, project)}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-bold transition-all"
                style={{
                  backgroundColor: done ? a.color : current ? a.bgColor : "#F5F3FA",
                  color: done ? "white" : current ? a.color : "#B0A8C0",
                  border: current ? `2px solid ${a.color}` : "2px solid transparent",
                  boxShadow: current ? `0 2px 12px ${a.color}40` : "none",
                }}
              >
                {done ? <CheckCircle2 size={14} /> : <AgentAvatar agentId={a.id} size={22} />}
                <span>{a.name}</span>
              </button>
              {idx < 4 && <ChevronRight size={12} style={{ color: "#C4B5E8" }} />}
            </div>
          );
        })}
      </div>

      {/* 進捗ステータスバー */}
      {phaseNum !== null && (
        <div
          className="px-4 py-2 flex items-center justify-between text-xs"
          style={{
            backgroundColor: pendingTransition ? "#F0FDF4" : agent.bgColor,
            borderBottom: `1px solid ${pendingTransition ? "#86EFAC" : agent.borderColor}`,
            transition: "background-color 0.3s",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded-full font-black text-[10px]"
              style={{ backgroundColor: agent.color, color: "white" }}
            >
              フェーズ {phaseNum}/5
            </span>
            <span className="font-bold" style={{ color: "#3D3250" }}>
              {agent.name}
            </span>
            <span style={{ color: "#8B82A0" }}>—</span>
            <span style={{ color: "#8B82A0" }}>{agent.role}</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium" style={{ color: statusColor }}>
            {(completing || sending) && (
              <div
                className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                style={{ borderColor: agent.color, borderTopColor: "transparent" }}
              />
            )}
            {pendingTransition && !completing && !sending && (
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#22C55E" }} />
            )}
            <span>{statusText}</span>
          </div>
        </div>
      )}

      {/* チャットエリア */}
      <div className="relative flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {/* エージェント名バー */}
        <div className="flex justify-center mb-2">
          <div
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold"
            style={{ backgroundColor: agent.bgColor, color: agent.color, border: `1.5px solid ${agent.borderColor}` }}
          >
            <AgentAvatar agentId={activeAgent} size={18} />
            {agent.name} — {agent.role}
            {isCompleted && <span className="ml-1">✅</span>}
          </div>
        </div>

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 chat-bubble ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            {msg.role === "assistant" && (
              <div className="shrink-0 self-end">
                <AgentAvatar agentId={activeAgent} size={40} />
              </div>
            )}
            <div
              className="max-w-[82%] px-4 py-3 rounded-2xl"
              style={
                msg.role === "assistant"
                  ? {
                      backgroundColor: "white",
                      color: "#3D3250",
                      border: `1.5px solid ${agent.borderColor}`,
                      borderBottomLeftRadius: "6px",
                      boxShadow: "0 2px 8px rgba(155,126,200,0.08)",
                    }
                  : {
                      background: `linear-gradient(135deg, ${agent.color}, ${agent.color}CC)`,
                      color: "white",
                      borderBottomRightRadius: "6px",
                    }
              }
            >
              {msg.role === "assistant"
                ? <MessageContent content={msg.content} />
                : <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              }
            </div>
          </div>
        ))}

        {/* 送信中インジケーター */}
        {sending && (
          <div className="flex gap-3 chat-bubble">
            <div className="shrink-0 self-end">
              <AgentAvatar agentId={activeAgent} size={40} />
            </div>
            <div
              className="px-5 py-3 rounded-2xl space-y-2"
              style={{
                backgroundColor: "white",
                border: `1.5px solid ${agent.borderColor}`,
                borderBottomLeftRadius: "6px",
                minWidth: "180px",
              }}
            >
              <div className="flex gap-1.5 items-center">
                {[0, 150, 300].map((delay) => (
                  <div
                    key={delay}
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: agent.color,
                      animation: "bounce 1s ease-in-out infinite",
                      animationDelay: `${delay}ms`,
                    }}
                  />
                ))}
              </div>
              {/* 進捗ラベル */}
              <p className="text-xs font-medium" style={{ color: agent.color }}>
                {getProgressLabel(activeAgent, sendingElapsed)}
              </p>
              {/* 経過バー */}
              <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: agent.bgColor }}>
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    backgroundColor: agent.color,
                    width: `${Math.min(95, (sendingElapsed / 600) * 100)}%`,
                    opacity: 0.7,
                  }}
                />
              </div>
              <p className="text-[10px]" style={{ color: "#C0B8D0" }}>
                {sendingElapsed}秒経過
              </p>
            </div>
          </div>
        )}

        {/* 引き継ぎ中インジケーター */}
        {completing && (
          <div className="flex gap-3 chat-bubble">
            <div className="shrink-0 self-end">
              <AgentAvatar agentId={activeAgent} size={40} />
            </div>
            <div
              className="px-5 py-4 rounded-2xl space-y-1.5"
              style={{
                backgroundColor: "white",
                border: `1.5px solid ${agent.borderColor}`,
                borderBottomLeftRadius: "6px",
              }}
            >
              <div className="flex gap-1.5 items-center">
                {[0, 150, 300].map((delay) => (
                  <div
                    key={delay}
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: agent.color,
                      animation: "bounce 1s ease-in-out infinite",
                      animationDelay: `${delay}ms`,
                    }}
                  />
                ))}
              </div>
              <p className="text-xs font-bold" style={{ color: "#3D3250" }}>
                会話内容をまとめて次のエージェントに引き継いでいます
              </p>
              <p className="text-[10px]" style={{ color: "#B0A8C0" }}>
                完了後に自動で次の画面へ移動します
              </p>
            </div>
          </div>
        )}

        {/* 次フェーズ移行チップ（AIが「次へ」と言ったとき） */}
        {pendingTransition && !completing && !isCompleted && (
          <div className="flex justify-center">
            <button
              onClick={() => void handleCompleteStep()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:scale-105 active:scale-95"
              style={{
                backgroundColor: "#F0FDF4",
                color: "#16A34A",
                border: "2px solid #86EFAC",
                boxShadow: "0 2px 12px #86EFAC60",
              }}
            >
              <ArrowRight size={15} />
              次のフェーズへ進む（または「OK」と入力）
            </button>
          </div>
        )}

        {error && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm chat-bubble"
            style={{ backgroundColor: "#FEF0F5", color: "#E8769A", border: "1.5px solid #F5C2D3" }}
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 入力エリア */}
      <div
        className="relative px-4 py-3"
        style={{ backgroundColor: "white", borderTop: `2px solid ${agent.borderColor}` }}
      >
        {/* Vercelデプロイセクション（全フェーズ完了後） */}
        {allPhasesCompleted && (
          <div
            className="w-full mb-3 p-4 rounded-xl"
            style={{ background: "linear-gradient(135deg, #F0FDF4, #ECFDF5)", border: "2px solid #86EFAC" }}
          >
            {deployUrl ? (
              <div className="space-y-2">
                <p className="text-sm font-black" style={{ color: "#15803D" }}>🎉 デプロイ完了！公開URLはこちら：</p>
                <a
                  href={deployUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm font-mono underline break-all transition-opacity hover:opacity-70"
                  style={{ color: "#1D4ED8" }}
                >
                  {deployUrl}
                </a>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black" style={{ color: "#15803D" }}>🚀 全フェーズ完了！</p>
                  <p className="text-xs mt-0.5" style={{ color: "#16A34A" }}>Vercelにデプロイしてアプリを公開しましょう</p>
                  {deployError && <p className="text-xs mt-1 text-red-500">{deployError}</p>}
                </div>
                <button
                  onClick={() => void handleDeploy()}
                  disabled={deploying}
                  className="shrink-0 px-4 py-2 rounded-xl text-sm font-black transition-all active:scale-95 disabled:opacity-60"
                  style={{ backgroundColor: "#16A34A", color: "white" }}
                >
                  {deploying ? "デプロイ中…" : "Vercelにデプロイ"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* フェーズ完了ボタン（手動フォールバック） */}
        {activeAgent > 0 && !isCompleted && hasEnoughMessages && !pendingTransition && (
          <button
            onClick={() => void handleCompleteStep()}
            disabled={completing}
            className="w-full mb-2 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: completing
                ? `linear-gradient(135deg, ${agent.borderColor}, #F0EDF8)`
                : `linear-gradient(135deg, ${agent.bgColor}, white)`,
              color: agent.color,
              border: `2px solid ${agent.borderColor}`,
              boxShadow: completing ? "none" : `0 2px 8px ${agent.color}20`,
            }}
          >
            {completing ? (
              <>
                <div
                  className="w-4 h-4 rounded-full border-2 animate-spin"
                  style={{ borderColor: agent.color, borderTopColor: "transparent" }}
                />
                引き継ぎ中…
              </>
            ) : (
              <>
                <AgentAvatar agentId={activeAgent} size={20} />
                {agent.name}のフェーズを完了して次のエージェントへ →
              </>
            )}
          </button>
        )}

        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder={
              pendingTransition
                ? "「OK」と入力すると次のフェーズへ自動で進みます"
                : `${agent.name}に話しかける… (Shift+Enter で送信)`
            }
            rows={2}
            className="flex-1 px-4 py-3 rounded-2xl border text-sm outline-none resize-none transition-all"
            style={{
              borderColor: pendingTransition ? "#86EFAC" : agent.borderColor,
              backgroundColor: pendingTransition ? "#F0FDF4" : agent.bgColor,
              color: "#3D3250",
              maxHeight: "160px",
              lineHeight: "1.5",
            }}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || sending}
            className="p-3 rounded-2xl text-white transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-40 shrink-0"
            style={{ background: `linear-gradient(135deg, ${agent.color}, ${agent.color}CC)` }}
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[10px] mt-1 text-center" style={{ color: "#B0A8C0" }}>
          Enter で改行 / Shift+Enter で送信
        </p>
      </div>
    </div>
  );
}
