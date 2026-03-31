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
    title: "Supabase アカウントを作成 / ログインする",
    description: "まず Supabase のアカウントが必要。すでにある場合はログインするだけでOK。",
    actions: [
      { label: "Supabase のサイトを開く", type: "link", value: "https://supabase.com/dashboard" },
      { label: "アカウントがない場合：画面中央の「Start your project」→「Sign Up」をクリック。GitHub や Google でのログインが一番簡単", type: "text", value: "" },
      { label: "すでにアカウントがある場合：右上の「Sign In」からログイン", type: "text", value: "" },
      { label: "ログインすると「All Projects」という画面が表示される。ここがスタート地点", type: "text", value: "" },
    ],
  },
  {
    number: 2,
    title: "新しいプロジェクトを作成する",
    description: "アプリ用のデータベースを入れる「プロジェクト」を新規作成する。",
    actions: [
      { label: "画面左上の「New project」ボタンをクリック（緑色のボタン）", type: "text", value: "" },
      { label: "Organization は「Personal」のまま選択してOK（変えなくて良い）", type: "text", value: "" },
      { label: "「Project name」に好きな名前を英数字で入力（例：my-app）", type: "text", value: "" },
      { label: "「Database Password」に安全なパスワードを入力。どこかにメモしておく（後で使う可能性あり）", type: "text", value: "" },
      { label: "「Region」は「Northeast Asia (Tokyo)」を選ぶと日本から速い", type: "text", value: "" },
      { label: "「Create new project」ボタンをクリック", type: "text", value: "" },
      { label: "「Setting up your project...」という画面になるので 1〜2分待つ。「Welcome to your new project」が出たら完了", type: "text", value: "" },
    ],
  },
  {
    number: 3,
    title: "SQL Editor でデータベースを構築する",
    description: "アプリが使うテーブル（データの入れ物）を作る。supabase-schema.sql ファイルを使う。",
    actions: [
      { label: "まず supabase-schema.sql をテキストエディタで開く。Finder でホーム → claude_setup → devstudio の中にある", type: "text", value: "" },
      { label: "ファイルのパス（参考）", type: "copy", value: "~/claude_setup/devstudio/supabase-schema.sql" },
      { label: "ファイルを開いたら中身を全部選択（Command + A）してコピー（Command + C）", type: "text", value: "" },
      { label: "Supabase ダッシュボードに戻り、左サイドバーの「<>」マーク（「SQL Editor」）をクリック", type: "text", value: "" },
      { label: "画面中央の白い入力エリア（「Write a query...」と書いてある場所）をクリック", type: "text", value: "" },
      { label: "全選択（Command + A）してから、コピーした内容を貼り付け（Command + V）", type: "text", value: "" },
      { label: "右下の緑色「Run」ボタンをクリック（または Command + Enter）", type: "text", value: "" },
      { label: "画面下部に「Success. No rows returned」と表示されれば成功。エラーが出たら内容を確認", type: "text", value: "" },
    ],
  },
  {
    number: 4,
    title: "Storage バケットを作成する",
    description: "画像ファイルをアップロードするための保存場所「バケット」を作る。",
    actions: [
      { label: "左サイドバーの「Storage」をクリック（バケツのようなアイコン）", type: "text", value: "" },
      { label: "「New bucket」ボタンをクリック（画面右上あたり）", type: "text", value: "" },
      { label: "「Bucket name」欄にバケット名を入力（以下をコピーして貼り付け）", type: "copy", value: "receipt-images" },
      { label: "「Public bucket」のトグルスイッチは必ず OFF のまま（デフォルトOFF）。ONにするとURLを知っていれば誰でもアクセスできてしまうため", type: "text", value: "" },
      { label: "「Save」ボタンをクリック。左のリストに「receipt-images」が追加されれば完了", type: "text", value: "" },
    ],
  },
  {
    number: 5,
    title: "接続情報（URL と API Key）を取得する",
    description: "アプリが Supabase に接続するための2つの値を取得する。",
    actions: [
      { label: "左サイドバーの一番下にある「Settings」（歯車アイコン）をクリック", type: "text", value: "" },
      { label: "左メニューの「API」をクリック（「Data API」と書かれている場合もある）", type: "text", value: "" },
      { label: "「Project URL」の右にある「Copy」ボタンをクリック → これが NEXT_PUBLIC_SUPABASE_URL として使う値", type: "text", value: "" },
      { label: "少し下にスクロールして「Project API keys」セクションを探す", type: "text", value: "" },
      { label: "「anon」「public」と書かれた行の右にある「Copy」ボタンをクリック → これが NEXT_PUBLIC_SUPABASE_ANON_KEY として使う値", type: "text", value: "" },
      { label: "2つの値をどこかにメモしておく（次のステップで使う）", type: "text", value: "" },
    ],
  },
  {
    number: 6,
    title: ".env.local に設定を書き込む",
    description: "取得した URL と API Key をアプリの設定ファイルに書き込む。",
    actions: [
      { label: "Finder を開いて、画面上部メニューの「移動」→「ホーム」をクリック", type: "text", value: "" },
      { label: "隠しファイルを表示する：キーボードで Command + Shift + .（ピリオド）を押す。.env.local が見えるようになる", type: "text", value: "" },
      { label: "claude_setup → devstudio フォルダの中の「.env.local」ファイルを右クリック → 「このアプリケーションで開く」→「テキストエディット」", type: "text", value: "" },
      { label: "ファイルの中に以下の3行が並んでいる。NEXT_PUBLIC_SUPABASE_URL= の後ろ（= の右側）に手順5でコピーした URL を貼り付ける", type: "text", value: "" },
      { label: "NEXT_PUBLIC_SUPABASE_ANON_KEY= の後ろに手順5でコピーした anon キーを貼り付ける", type: "text", value: "" },
      { label: "GEMINI_API_KEY はそのままでOK（すでに設定済み）", type: "text", value: "" },
      { label: "Command + S で保存してファイルを閉じる", type: "text", value: "" },
    ],
  },
  {
    number: 7,
    title: "開発サーバーを起動する",
    description: "ターミナルでアプリを起動する。",
    actions: [
      { label: "ターミナルを開く（Dock の黒いアイコン、または Spotlight で「ターミナル」と検索）", type: "text", value: "" },
      { label: "以下のコマンドをコピーしてターミナルに貼り付け、Enter を押す", type: "copy", value: "cd ~/claude_setup/devstudio && npm run dev --webpack" },
      { label: "「▲ Next.js ... Ready in ...ms」と表示されたら起動完了", type: "text", value: "" },
      { label: "このターミナルは起動中は閉じない（閉じるとアプリが止まる）", type: "text", value: "" },
    ],
  },
  {
    number: 8,
    title: "ユーザーアカウントを作成する",
    description: "アプリにログインするための自分のアカウントを Supabase で作成する。",
    actions: [
      { label: "Supabase ダッシュボードに戻り、左サイドバーの「Authentication」（人型アイコン）をクリック", type: "text", value: "" },
      { label: "上部メニューの「Users」タブをクリック", type: "text", value: "" },
      { label: "右上の「Add user」ボタンをクリック → 「Create new user」を選択", type: "text", value: "" },
      { label: "「Email」に使いたいメールアドレスを入力（実在しなくてもOK。例: me@example.com）", type: "text", value: "" },
      { label: "「Password」に好きなパスワードを入力", type: "text", value: "" },
      { label: "「Create user」ボタンをクリック。リストにユーザーが追加されれば完了", type: "text", value: "" },
    ],
  },
  {
    number: 9,
    title: "ログインして使い始める",
    description: "ブラウザでアプリを開いて、作成したアカウントでログインする。",
    actions: [
      { label: "アプリのログイン画面を開く", type: "link", value: "http://localhost:3000/auth/login" },
      { label: "手順8で設定したメールアドレスとパスワードを入力", type: "text", value: "" },
      { label: "「ログイン」ボタンをクリック → アプリのトップ画面が表示されれば設定完了！", type: "text", value: "" },
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
                <h2 className="font-black text-base" style={{ color: "#3D2B6B" }}>🚀 セットアップ手順</h2>
                <p className="text-xs mt-0.5" style={{ color: "#8B82A0" }}>Supabase設定〜ログインまでの全ステップ</p>
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
