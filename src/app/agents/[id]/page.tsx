"use client";

import { useParams, useRouter } from "next/navigation";
import { AGENTS } from "@/lib/agents";
import AgentAvatar from "@/components/agents/AgentAvatar";
import { ArrowLeft } from "lucide-react";

export default function AgentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const agentId = parseInt(id, 10);
  const agent = AGENTS.find((a) => a.id === agentId);

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-primary)" }}>
        <p style={{ color: "#8B82A0" }}>キャラクターが見つかりません</p>
      </div>
    );
  }

  const { profile } = agent;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
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
        className="relative px-6 py-4 flex items-center gap-3"
        style={{
          background: `linear-gradient(135deg, ${agent.bgColor} 0%, white 100%)`,
          borderBottom: `2px solid ${agent.borderColor}`,
        }}
      >
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full transition-opacity hover:opacity-70"
          style={{ backgroundColor: agent.bgColor, color: agent.color }}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <AgentAvatar agentId={agentId} size={40} />
          <div>
            <h1 className="font-black text-base" style={{ color: "#3D3250" }}>{agent.name}</h1>
            <p className="text-xs" style={{ color: "#8B82A0" }}>{agent.role}</p>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row gap-8 items-start">

          {/* 左: アバター */}
          <div
            className="w-full md:w-72 shrink-0 flex flex-col items-center rounded-3xl py-8 px-4"
            style={{
              background: `linear-gradient(180deg, ${agent.bgColor} 0%, white 100%)`,
              border: `2px solid ${agent.borderColor}`,
            }}
          >
            <AgentAvatar agentId={agentId} size={160} />

            {/* 名前バッジ */}
            <div
              className="mt-4 px-5 py-2 rounded-full text-sm font-black"
              style={{ backgroundColor: agent.color, color: "white" }}
            >
              {agent.emoji} {agent.name}
            </div>
            <p className="text-xs mt-1 font-medium" style={{ color: "#8B82A0" }}>{agent.role}</p>

            {/* 口癖 */}
            <div
              className="mt-5 px-4 py-3 rounded-2xl text-sm text-center italic"
              style={{ backgroundColor: "white", border: `1.5px solid ${agent.borderColor}`, color: agent.color }}
            >
              「{profile.catchphrase}」
            </div>
          </div>

          {/* 右: プロフィール情報 */}
          <div className="flex-1 space-y-4">

            {/* 基本情報カード */}
            <div
              className="rounded-3xl p-5"
              style={{ backgroundColor: "white", border: `2px solid ${agent.borderColor}`, boxShadow: `0 4px 16px ${agent.color}15` }}
            >
              <h2 className="text-xs font-bold mb-3 px-1" style={{ color: "#8B82A0", letterSpacing: "0.08em" }}>
                PROFILE
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "年齢", value: `${profile.age}歳` },
                  { label: "肩書き", value: profile.jobTitle },
                  { label: "社歴", value: profile.tenure },
                  { label: "キャラ", value: profile.characterType },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl px-4 py-3"
                    style={{ backgroundColor: agent.bgColor }}
                  >
                    <p className="text-[10px] font-bold mb-1" style={{ color: agent.color, letterSpacing: "0.06em" }}>
                      {label}
                    </p>
                    <p className="text-sm font-bold" style={{ color: "#3D3250" }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 紹介文 */}
            <div
              className="rounded-3xl p-5"
              style={{ backgroundColor: "white", border: `2px solid ${agent.borderColor}` }}
            >
              <h2 className="text-xs font-bold mb-2 px-1" style={{ color: "#8B82A0", letterSpacing: "0.08em" }}>
                ABOUT
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "#3D3250" }}>
                {profile.backstory}
              </p>
            </div>

            {/* 趣味 */}
            <div
              className="rounded-3xl p-5"
              style={{ backgroundColor: "white", border: `2px solid ${agent.borderColor}` }}
            >
              <h2 className="text-xs font-bold mb-3 px-1" style={{ color: "#8B82A0", letterSpacing: "0.08em" }}>
                HOBBIES
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.hobbies.map((hobby) => (
                  <span
                    key={hobby}
                    className="px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: agent.bgColor, color: agent.color, border: `1.5px solid ${agent.borderColor}` }}
                  >
                    {hobby}
                  </span>
                ))}
              </div>
            </div>

            {/* 好きなもの */}
            <div
              className="rounded-3xl p-5"
              style={{ backgroundColor: "white", border: `2px solid ${agent.borderColor}` }}
            >
              <h2 className="text-xs font-bold mb-3 px-1" style={{ color: "#8B82A0", letterSpacing: "0.08em" }}>
                LIKES
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.likes.map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: "#F8F5FF", color: "#6B5A8A", border: "1.5px solid #E8E0F5" }}
                  >
                    ♡ {item}
                  </span>
                ))}
              </div>
            </div>

            {/* 担当内容 */}
            <div
              className="rounded-3xl p-5"
              style={{
                background: `linear-gradient(135deg, ${agent.bgColor}, white)`,
                border: `2px solid ${agent.borderColor}`,
              }}
            >
              <h2 className="text-xs font-bold mb-2 px-1" style={{ color: "#8B82A0", letterSpacing: "0.08em" }}>
                ROLE
              </h2>
              <p className="text-sm font-bold mb-1" style={{ color: agent.color }}>{agent.role}</p>
              <p className="text-xs leading-relaxed" style={{ color: "#8B82A0" }}>{agent.description}</p>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
