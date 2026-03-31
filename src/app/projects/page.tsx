"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Sparkles, ChevronRight } from "lucide-react";
import { Project } from "@/lib/types";
import { AGENTS } from "@/lib/agents";
import AgentAvatar from "@/components/agents/AgentAvatar";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchProjects() {
    const res = await fetch("/api/projects");
    const json = await res.json() as { success: boolean; data: Project[] };
    if (json.success) setProjects(json.data);
  }

  useEffect(() => { void fetchProjects(); }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    setName(""); setDescription("");
    setShowModal(false); setLoading(false);
    void fetchProjects();
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm("このプロジェクトを削除しますか？")) return;
    await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
    void fetchProjects();
  }

  const currentAgent = (p: Project) => AGENTS.find((a) => a.id === p.currentAgent) ?? AGENTS[1];

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* ドット背景 */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, rgba(155,126,200,0.18) 1.5px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* 浮遊デコレーション */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[
          { x: "8%", y: "12%", s: "1.4rem", d: "0s", sym: "✨" },
          { x: "88%", y: "8%",  s: "1.2rem", d: "0.5s", sym: "⭐" },
          { x: "5%",  y: "55%", s: "1rem",   d: "1s",   sym: "💫" },
          { x: "92%", y: "48%", s: "1.3rem", d: "1.5s", sym: "✨" },
          { x: "15%", y: "82%", s: "1.1rem", d: "0.8s", sym: "⭐" },
          { x: "78%", y: "78%", s: "1rem",   d: "2s",   sym: "💫" },
          { x: "50%", y: "5%",  s: "1.2rem", d: "0.3s", sym: "✨" },
        ].map((d, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: d.x, top: d.y, fontSize: d.s,
              animation: `floatDeco 4s ease-in-out infinite`,
              animationDelay: d.d,
              opacity: 0.55,
            }}
          >
            {d.sym}
          </div>
        ))}
      </div>

      {/* ヘッダー */}
      <header
        className="relative px-6 py-5"
        style={{
          background: "linear-gradient(135deg, #e8d0f8 0%, #c8ddf8 50%, #d8f0e8 100%)",
          borderBottom: "2px solid rgba(155,126,200,0.2)",
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* ロゴ */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl font-bold shadow-md"
              style={{ background: "linear-gradient(135deg, #9B7EC8, #E8769A)", color: "white" }}
            >
              DS
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight" style={{ color: "#3D3250" }}>
                DevStudio
              </h1>
              <p className="text-xs font-medium" style={{ color: "#8B82A0" }}>
                AIと一緒にアプリを作ろう ✨
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-bold shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 shrink-0"
            style={{ background: "linear-gradient(135deg, #9B7EC8, #E8769A)" }}
          >
            <Plus size={16} />
            新規プロジェクト
          </button>
        </div>
      </header>

      {/* ===== AIエージェントチーム 横並び全身表示 ===== */}
      <section className="relative max-w-7xl mx-auto px-6 pt-8 pb-4">
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: "white",
            border: "2px solid rgba(155,126,200,0.2)",
            boxShadow: "0 4px 24px rgba(155,126,200,0.1)",
          }}
        >
          {/* セクションヘッダー */}
          <div
            className="px-6 py-4"
            style={{
              background: "linear-gradient(135deg, #f0e8fc 0%, #e8f0fc 50%, #e8fcf4 100%)",
              borderBottom: "1.5px solid rgba(155,126,200,0.15)",
            }}
          >
            <p className="text-xs font-black tracking-widest" style={{ color: "#8B82A0" }}>
              AI AGENT TEAM
            </p>
            <p className="text-sm mt-0.5" style={{ color: "#B0A8C0" }}>
              キャラクターをクリックして詳しく見る
            </p>
          </div>

          {/* 横並びエージェント */}
          <div className="flex items-end justify-around px-4 py-6 gap-2 overflow-x-auto">
            {AGENTS.map((agent) => (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="flex flex-col items-center gap-2 shrink-0 group cursor-pointer"
                style={{ minWidth: "90px", maxWidth: "120px" }}
              >
                {/* アバター */}
                <div
                  className="relative rounded-2xl p-3 transition-all group-hover:scale-105 group-hover:shadow-lg"
                  style={{
                    background: `linear-gradient(180deg, ${agent.bgColor} 0%, white 100%)`,
                    border: `2px solid ${agent.borderColor}`,
                  }}
                >
                  <AgentAvatar agentId={agent.id} size={72} />

                  {/* ホバー時のオーバーレイ */}
                  <div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    style={{ backgroundColor: `${agent.color}18` }}
                  >
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: agent.color, color: "white" }}>
                      プロフィール
                    </span>
                  </div>
                </div>

                {/* 名前・役割 */}
                <div className="text-center">
                  <p className="text-sm font-black leading-tight" style={{ color: agent.color }}>{agent.name}</p>
                  <p className="text-[9px] leading-tight mt-0.5 px-1" style={{ color: "#B0A8C0" }}>{agent.role}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== メインレイアウト: プロジェクト一覧 + サイドパネル ===== */}
      <div className="max-w-7xl mx-auto px-6 pb-10">
        <div className="flex gap-6 items-start">

          {/* プロジェクト一覧（左・メイン） */}
          <main className="flex-1 min-w-0">
            {projects.length === 0 ? (
              /* 空の状態 */
              <div className="flex flex-col items-center justify-center py-10">
                <div
                  className="w-full max-w-md rounded-3xl p-8 text-center"
                  style={{
                    background: "white",
                    border: "2px dashed rgba(155,126,200,0.4)",
                    boxShadow: "0 4px 24px rgba(155,126,200,0.12)",
                  }}
                >
                  <div className="flex justify-center mb-4">
                    <AgentAvatar agentId={1} size={80} />
                  </div>
                  <h2 className="text-xl font-black mb-2" style={{ color: "#3D3250" }}>
                    まだプロジェクトがないよ！
                  </h2>
                  <p className="text-sm mb-2" style={{ color: "#8B82A0" }}>
                    「新規プロジェクト」ボタンを押して、
                  </p>
                  <p className="text-sm mb-6" style={{ color: "#8B82A0" }}>
                    ルカたちと一緒にアプリを作り始めよう✨
                  </p>
                  <button
                    onClick={() => setShowModal(true)}
                    className="px-8 py-3 rounded-full text-white font-bold text-sm shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
                    style={{ background: "linear-gradient(135deg, #E8769A, #9B7EC8)" }}
                  >
                    <Sparkles size={15} className="inline mr-2" />
                    最初のプロジェクトを作る
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-6">
                {projects.map((project) => {
                  const agent = currentAgent(project);
                  const completedCount = project.sessions.filter((s) => s.completed).length;
                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="block rounded-3xl p-5 transition-all hover:shadow-xl hover:-translate-y-1 relative group"
                      style={{
                        background: `linear-gradient(135deg, ${agent.bgColor} 0%, white 60%)`,
                        border: `2px solid ${agent.borderColor}`,
                        boxShadow: "0 4px 16px rgba(155,126,200,0.1)",
                      }}
                    >
                      <button
                        onClick={(e) => handleDelete(project.id, e)}
                        className="absolute top-4 right-4 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ backgroundColor: "#FEF0F5", color: "#E8769A" }}
                      >
                        <Trash2 size={14} />
                      </button>

                      <div className="flex items-center gap-4 mb-4">
                        <AgentAvatar agentId={agent.id} size={64} />
                        <div>
                          <div
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mb-1"
                            style={{ backgroundColor: agent.color, color: "white" }}
                          >
                            {agent.emoji} {agent.name}が担当中
                          </div>
                          <h3 className="font-black text-base" style={{ color: "#3D3250" }}>
                            {project.name}
                          </h3>
                          {project.description && (
                            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "#8B82A0" }}>
                              {project.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 進行ステップ */}
                      <div className="flex items-center gap-1.5">
                        {AGENTS.slice(1, 6).map((a, idx) => {
                          const s = project.sessions.find((ss) => ss.agentId === a.id);
                          const done = s?.completed ?? false;
                          const current = project.currentAgent === a.id;
                          return (
                            <div key={a.id} className="flex items-center gap-1.5 flex-1">
                              <div
                                className="flex-1 h-2 rounded-full transition-all"
                                style={{ backgroundColor: done ? a.color : current ? a.borderColor : "#EDE8F5" }}
                              />
                              {idx < 4 && <ChevronRight size={10} style={{ color: "#C4B5E8", flexShrink: 0 }} />}
                            </div>
                          );
                        })}
                        <span className="text-[10px] font-bold ml-1 shrink-0" style={{ color: "#8B82A0" }}>
                          {completedCount}/5
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </main>

          {/* サイドパネル（xl以上で表示） */}
          <aside className="hidden xl:flex flex-col gap-4 shrink-0 pt-6" style={{ width: "280px" }}>

            {/* 使い方ガイド */}
            <div
              className="rounded-3xl p-5"
              style={{ background: "white", border: "2px solid rgba(155,126,200,0.2)", boxShadow: "0 4px 16px rgba(155,126,200,0.08)" }}
            >
              <p className="text-xs font-black mb-3" style={{ color: "#8B82A0", letterSpacing: "0.08em" }}>HOW IT WORKS</p>
              <div className="space-y-3">
                {[
                  { emoji: "💡", label: "アイデアを話す", desc: "ルカにざっくりアイデアを伝えよう" },
                  { emoji: "📐", label: "設計する", desc: "レンが画面・機能の構成を整理" },
                  { emoji: "⚡", label: "コードを書く", desc: "コウが実装方法を決める" },
                  { emoji: "🔍", label: "テストする", desc: "ミオが動作確認・バグ出し" },
                  { emoji: "⭐", label: "最終レビュー", desc: "ハルが総合評価・改善提案" },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-sm shrink-0 mt-0.5"
                      style={{ background: "linear-gradient(135deg, #f0e8fc, #e8f0fc)" }}
                    >
                      {step.emoji}
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: "#3D3250" }}>{step.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "#B0A8C0" }}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ソラ + カイのカード */}
            <div
              className="rounded-3xl p-4"
              style={{ background: "linear-gradient(135deg, #EEF4FB, white)", border: "2px solid #BDD4ED" }}
            >
              <p className="text-xs font-black mb-3" style={{ color: "#8B82A0", letterSpacing: "0.08em" }}>ALWAYS AVAILABLE</p>
              {[AGENTS[0], AGENTS[6]].map((agent) => (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className="flex items-center gap-3 p-3 rounded-2xl mb-2 last:mb-0 transition-all hover:opacity-80"
                  style={{ backgroundColor: agent.bgColor, border: `1.5px solid ${agent.borderColor}` }}
                >
                  <AgentAvatar agentId={agent.id} size={36} />
                  <div>
                    <p className="text-xs font-black" style={{ color: agent.color }}>{agent.name}</p>
                    <p className="text-[10px]" style={{ color: "#B0A8C0" }}>{agent.role}</p>
                  </div>
                </Link>
              ))}
            </div>

          </aside>
        </div>
      </div>

      {/* 新規作成モーダル */}
      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: "rgba(61,50,80,0.45)" }}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl p-6 pop-in"
            style={{ backgroundColor: "white", boxShadow: "0 12px 48px rgba(155,126,200,0.3)" }}
          >
            <div className="text-center mb-5">
              <AgentAvatar agentId={1} size={64} className="mx-auto mb-3" />
              <h2 className="text-xl font-black" style={{ color: "#3D3250" }}>新しいプロジェクト</h2>
              <p className="text-sm mt-1" style={{ color: "#8B82A0" }}>
                ルカが一緒に整理してくれるよ！
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="プロジェクト名（例：家計簿アプリ）"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                style={{ borderColor: "#E8769A", backgroundColor: "#FEF5F8", color: "#3D3250" }}
                autoFocus
              />
              <textarea
                placeholder="ざっくりどんなアプリか（任意）"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "#3D3250" }}
              />
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{ backgroundColor: "var(--bg-primary)", color: "#8B82A0" }}
              >
                キャンセル
              </button>
              <button
                onClick={() => void handleCreate()}
                disabled={loading || !name.trim()}
                className="flex-1 py-3 rounded-xl text-white text-sm font-bold shadow-md disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #9B7EC8, #E8769A)" }}
              >
                {loading ? "作成中…" : "✨ 作成する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
