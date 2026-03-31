"use client";

import { useState } from "react";
import { X, ExternalLink, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";

interface Step {
  number: number;
  title: string;
  description: string;
  actions: Action[];
}

interface Action {
  label: string;
  type: "link" | "copy" | "text";
  value: string;
}

const STEPS: Step[] = [
  {
    number: 1,
    title: "Supabase プロジェクトを作成する",
    description: "クラウドのデータベースサービス「Supabase」に新しいプロジェクトを作る。",
    actions: [
      { label: "Supabase ダッシュボードを開く", type: "link", value: "https://supabase.com/dashboard" },
      { label: "右上の「+ New project」をクリックして、プロジェクト名とパスワードを設定して作成", type: "text", value: "" },
    ],
  },
  {
    number: 2,
    title: "SQL Editor でデータベースを作成する",
    description: "プロジェクトのデータを保存するテーブルを作る。",
    actions: [
      { label: "プロジェクトを開いたら、左サイドバーの「<>」アイコン（SQL Editor）をクリック", type: "text", value: "" },
      { label: "supabase-schema.sql を開いて中身を全部コピー", type: "text", value: "" },
      { label: "SQL Editor の入力欄に貼り付けて、右下の緑「Run」ボタンを押す", type: "text", value: "" },
      { label: "「Success. No rows returned」が出れば完了", type: "text", value: "" },
    ],
  },
  {
    number: 3,
    title: "Storage バケットを作成する",
    description: "領収書の画像を保存する場所を作る。",
    actions: [
      { label: "左サイドバーの「Storage」（バケツアイコン）をクリック", type: "text", value: "" },
      { label: "「New bucket」をクリック", type: "text", value: "" },
      { label: "バケット名に「receipt-images」と入力、Public は OFF のまま「Save」", type: "text", value: "" },
    ],
  },
  {
    number: 4,
    title: "API Key を取得する",
    description: "アプリがSupabaseに接続するための鍵を取得する。",
    actions: [
      { label: "左サイドバー下の「Settings」（歯車アイコン）→「API Keys」をクリック", type: "text", value: "" },
      { label: "「Legacy anon, service_role API keys」タブをクリック", type: "text", value: "" },
      { label: "「anon」行のキー（eyJ... で始まる文字列）をコピー", type: "text", value: "" },
    ],
  },
  {
    number: 5,
    title: ".env.local に設定を書き込む",
    description: "プロジェクトフォルダの .env.local ファイルに取得した値を設定する。",
    actions: [
      { label: "devstudio フォルダ内の .env.local をテキストエディタで開く", type: "text", value: "" },
      { label: "NEXT_PUBLIC_SUPABASE_URL=（あなたの Supabase URL）", type: "copy", value: "NEXT_PUBLIC_SUPABASE_URL=https://xxxxxx.supabase.co" },
      { label: "NEXT_PUBLIC_SUPABASE_ANON_KEY=（コピーした anon キー）", type: "copy", value: "NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ..." },
    ],
  },
  {
    number: 6,
    title: "開発サーバーを起動する",
    description: "ターミナルでアプリを起動する。",
    actions: [
      { label: "ターミナルアプリを開く（Dock の黒いアイコン）", type: "text", value: "" },
      { label: "以下のコマンドをコピーして実行", type: "copy", value: "cd ~/claude_setup/devstudio && npm run dev" },
      { label: "「Ready in〜」と出たら起動完了", type: "text", value: "" },
    ],
  },
  {
    number: 7,
    title: "ユーザーを登録する",
    description: "ログインするためのアカウントを Supabase で作成する。",
    actions: [
      { label: "Supabase の Authentication → Users を開く", type: "link", value: "https://supabase.com/dashboard" },
      { label: "右上「Add user」→「Create new user」をクリック", type: "text", value: "" },
      { label: "メールアドレスとパスワードを自分で決めて入力して「Create user」", type: "text", value: "" },
    ],
  },
  {
    number: 8,
    title: "ログインして使い始める",
    description: "ブラウザでアプリを開いて、作成したアカウントでログインする。",
    actions: [
      { label: "ログイン画面を開く", type: "link", value: "http://localhost:3000/auth/login" },
      { label: "手順7で設定したメールとパスワードを入力してログイン", type: "text", value: "" },
    ],
  },
];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all"
      style={{
        backgroundColor: copied ? "#DCFCE7" : "#F0EDF8",
        color: copied ? "#16A34A" : "#5B3FA0",
        border: `1px solid ${copied ? "#BBF7D0" : "#D8CCEF"}`,
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      <span className="max-w-[260px] truncate">{value}</span>
    </button>
  );
}

function StepCard({ step, index }: { step: Step; index: number }) {
  const [open, setOpen] = useState(index === 0);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1.5px solid #E2D9F3" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:opacity-80"
        style={{ backgroundColor: open ? "#F0EDF8" : "white" }}
      >
        <span
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
          style={{ backgroundColor: "#7C5CBF", color: "white" }}
        >
          {step.number}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: "#3D2B6B" }}>{step.title}</p>
          {!open && (
            <p className="text-xs mt-0.5 truncate" style={{ color: "#8B82A0" }}>{step.description}</p>
          )}
        </div>
        {open ? <ChevronUp size={16} color="#8B82A0" /> : <ChevronDown size={16} color="#8B82A0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1" style={{ backgroundColor: "white" }}>
          <p className="text-xs mb-3" style={{ color: "#6B5FA0" }}>{step.description}</p>
          <div className="space-y-2">
            {step.actions.map((action, i) => {
              if (action.type === "text") {
                return (
                  <div key={i} className="flex items-start gap-2">
                    <span
                      className="shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: "#E8D9F9", color: "#7B5BA8" }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-xs" style={{ color: "#3D2B6B" }}>{action.label}</p>
                  </div>
                );
              }
              if (action.type === "link") {
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: "#E8D9F9", color: "#7B5BA8" }}
                    >
                      {i + 1}
                    </span>
                    <a
                      href={action.value}
                      target={action.value.includes("localhost") ? "_self" : "_blank"}
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2 transition-opacity hover:opacity-70"
                      style={{ color: "#3B82F6" }}
                    >
                      <ExternalLink size={11} />
                      {action.label}
                    </a>
                  </div>
                );
              }
              if (action.type === "copy") {
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: "#E8D9F9", color: "#7B5BA8" }}
                    >
                      {i + 1}
                    </span>
                    <CopyButton value={action.value} />
                  </div>
                );
              }
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function SetupGuideButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:opacity-80"
        style={{ backgroundColor: "#F0EDF8", color: "#7C5CBF", border: "1.5px solid #D8CCEF" }}
      >
        📋 起動手順
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            style={{ backgroundColor: "white" }}
          >
            {/* モーダルヘッダー */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: "1.5px solid #E2D9F3", background: "linear-gradient(135deg, #F0EDF8 0%, white 100%)" }}
            >
              <div>
                <h2 className="font-black text-base" style={{ color: "#3D2B6B" }}>🚀 アプリ起動手順</h2>
                <p className="text-xs mt-0.5" style={{ color: "#8B82A0" }}>はじめて動かすときの全ステップ</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-full hover:opacity-70 transition-opacity"
                style={{ backgroundColor: "#E2D9F3" }}
              >
                <X size={16} color="#7C5CBF" />
              </button>
            </div>

            {/* ステップ一覧 */}
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {STEPS.map((step, i) => (
                <StepCard key={step.number} step={step} index={i} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
