"use client";

interface AgentAvatarProps {
  agentId: number;
  size?: number;
  className?: string;
}

// 各キャラの設定
const avatarConfigs = [
  // 0: ソラ (青 PM)
  {
    hairColor: "#5BB8F5",
    hairHighlight: "#90CDFB",
    bgColor: "#C8E6FD",
    eyeColor: "#2B5EA7",
    hair: "twintails",
    accessory: "star",
  },
  // 1: ルカ (ピンク Director)
  {
    hairColor: "#F07BA8",
    hairHighlight: "#F8AACA",
    bgColor: "#FDDAEC",
    eyeColor: "#9B3060",
    hair: "wavy",
    accessory: "bulb",
  },
  // 2: レン (紫 Architect)
  {
    hairColor: "#9565C9",
    hairHighlight: "#B997E0",
    bgColor: "#E8D9F9",
    eyeColor: "#4A2080",
    hair: "straight",
    accessory: "glasses",
  },
  // 3: コウ (濃紺 Developer)
  {
    hairColor: "#354570",
    hairHighlight: "#5468A0",
    bgColor: "#C5D3F0",
    eyeColor: "#1A2545",
    hair: "spiky",
    accessory: "headphone",
  },
  // 4: ミオ (ティール QA) — ショートカット×三つ編みリデザイン
  {
    hairColor: "#1AA898",
    hairHighlight: "#52D4C6",
    bgColor: "#B8ECE7",
    eyeColor: "#0A6B60",
    hair: "shortbraid",
    accessory: "none",
  },
  // 5: ハル (ゴールド Reviewer)
  {
    hairColor: "#D4A017",
    hairHighlight: "#F0C850",
    bgColor: "#FAE8A0",
    eyeColor: "#7A5500",
    hair: "long",
    accessory: "crown",
  },
  // 6: カイ (オレンジ 修正担当)
  {
    hairColor: "#D46A0A",
    hairHighlight: "#F09040",
    bgColor: "#FDE8C8",
    eyeColor: "#7A3500",
    hair: "spiky",
    accessory: "none",
  },
];

function HairTwintails({ color, highlight }: { color: string; highlight: string }) {
  return (
    <>
      {/* ツインテール (左) */}
      <ellipse cx="18" cy="48" rx="7" ry="14" fill={color} transform="rotate(-10 18 48)" />
      <ellipse cx="62" cy="48" rx="7" ry="14" fill={color} transform="rotate(10 62 48)" />
      {/* 後ろ髪 */}
      <ellipse cx="40" cy="34" rx="22" ry="20" fill={color} />
      {/* 前髪 */}
      <path d="M 18 34 Q 22 18 40 16 Q 58 18 62 34 Q 55 26 40 26 Q 25 26 18 34Z" fill={color} />
      {/* ハイライト */}
      <ellipse cx="34" cy="20" rx="5" ry="3" fill={highlight} opacity="0.7" transform="rotate(-20 34 20)" />
    </>
  );
}

function HairWavy({ color, highlight }: { color: string; highlight: string }) {
  return (
    <>
      {/* ウェーブ毛先 */}
      <path d="M 16 40 Q 14 56 18 64 Q 22 58 20 52 Q 24 60 26 64" fill={color} />
      <path d="M 64 40 Q 66 56 62 64 Q 58 58 60 52 Q 56 60 54 64" fill={color} />
      {/* 後ろ髪 */}
      <ellipse cx="40" cy="35" rx="24" ry="22" fill={color} />
      {/* 前髪 (ふわっと) */}
      <path d="M 16 34 Q 18 14 40 12 Q 62 14 64 34 Q 56 22 40 22 Q 24 22 16 34Z" fill={color} />
      <ellipse cx="32" cy="18" rx="6" ry="3" fill={highlight} opacity="0.7" transform="rotate(-15 32 18)" />
    </>
  );
}

function HairStraight({ color, highlight }: { color: string; highlight: string }) {
  return (
    <>
      {/* サイドのストレート */}
      <rect x="14" y="34" width="10" height="30" rx="5" fill={color} />
      <rect x="56" y="34" width="10" height="30" rx="5" fill={color} />
      {/* 後ろ */}
      <ellipse cx="40" cy="34" rx="22" ry="20" fill={color} />
      {/* 前髪 */}
      <path d="M 18 34 Q 22 16 40 14 Q 58 16 62 34 Q 56 24 40 24 Q 24 24 18 34Z" fill={color} />
      <ellipse cx="36" cy="18" rx="5" ry="2.5" fill={highlight} opacity="0.6" transform="rotate(-10 36 18)" />
    </>
  );
}

function HairSpiky({ color, highlight }: { color: string; highlight: string }) {
  return (
    <>
      {/* 後ろ */}
      <ellipse cx="40" cy="35" rx="22" ry="20" fill={color} />
      {/* トゲトゲ前髪 */}
      <path d="M 18 34 L 24 18 L 30 26 L 36 14 L 42 24 L 48 16 L 54 26 L 62 20 L 62 34 Q 55 26 40 26 Q 25 26 18 34Z" fill={color} />
      <ellipse cx="38" cy="18" rx="4" ry="2" fill={highlight} opacity="0.6" />
    </>
  );
}

function HairBob({ color, highlight }: { color: string; highlight: string }) {
  return (
    <>
      {/* ボブ */}
      <path d="M 16 34 Q 16 60 24 64 Q 32 68 40 66 Q 48 68 56 64 Q 64 60 64 34" fill={color} />
      {/* 前髪 */}
      <path d="M 18 34 Q 22 18 40 16 Q 58 18 62 34 Q 56 26 40 26 Q 24 26 18 34Z" fill={color} />
      <ellipse cx="34" cy="20" rx="5" ry="2.5" fill={highlight} opacity="0.7" transform="rotate(-15 34 20)" />
    </>
  );
}

// ミオ専用: ショートカット + サイドに小さな三つ編み
function HairShortBraid({ color, highlight }: { color: string; highlight: string }) {
  return (
    <>
      {/* 後ろ髪 (コンパクト) */}
      <ellipse cx="40" cy="36" rx="21" ry="18" fill={color} />
      {/* 前髪 — きっちりした直線バング */}
      <path d="M 20 36 Q 22 20 40 18 Q 58 20 60 36 Q 52 28 40 28 Q 28 28 20 36Z" fill={color} />
      {/* バングの下ライン (整った切りそろえ感) */}
      <path d="M 24 36 Q 40 30 56 36" fill={color} />
      {/* 右サイドに小三つ編み */}
      <ellipse cx="60" cy="44" rx="4" ry="7" fill={color} transform="rotate(10 60 44)" />
      <ellipse cx="60" cy="54" rx="3.5" ry="6" fill={color} transform="rotate(10 60 54)" />
      <ellipse cx="59" cy="63" rx="3" ry="5" fill={color} transform="rotate(8 59 63)" />
      {/* 三つ編み区切り線 */}
      <line x1="57" y1="49" x2="63" y2="49" stroke={highlight} strokeWidth="0.8" opacity="0.6" />
      <line x1="57" y1="57" x2="62" y2="57" stroke={highlight} strokeWidth="0.8" opacity="0.6" />
      {/* ハイライト */}
      <ellipse cx="33" cy="22" rx="6" ry="2.5" fill={highlight} opacity="0.65" transform="rotate(-10 33 22)" />
    </>
  );
}

function HairLong({ color, highlight }: { color: string; highlight: string }) {
  return (
    <>
      {/* ロングヘア */}
      <path d="M 14 34 Q 12 60 16 80 Q 20 72 18 64 Q 20 76 24 80" fill={color} />
      <path d="M 66 34 Q 68 60 64 80 Q 60 72 62 64 Q 60 76 56 80" fill={color} />
      {/* 後ろ */}
      <ellipse cx="40" cy="34" rx="24" ry="22" fill={color} />
      {/* 前髪 */}
      <path d="M 16 34 Q 20 14 40 12 Q 60 14 64 34 Q 56 22 40 22 Q 24 22 16 34Z" fill={color} />
      <ellipse cx="34" cy="17" rx="6" ry="3" fill={highlight} opacity="0.7" transform="rotate(-20 34 17)" />
    </>
  );
}

function Accessory({ type, eyeColor }: { type: string; eyeColor: string }) {
  switch (type) {
    case "star":
      return <path d="M 50 18 L 52 22 L 56 22 L 53 25 L 54 29 L 50 27 L 46 29 L 47 25 L 44 22 L 48 22Z" fill="#FFD700" stroke="#F0A800" strokeWidth="0.5" />;
    case "bulb":
      return (
        <>
          <circle cx="52" cy="18" r="5" fill="#FFE066" stroke="#F0C000" strokeWidth="0.8" />
          <rect x="50" y="22" width="4" height="2" rx="1" fill="#999" />
        </>
      );
    case "glasses":
      return (
        <>
          <circle cx="32" cy="45" r="7" fill="none" stroke={eyeColor} strokeWidth="1.5" opacity="0.5" />
          <circle cx="48" cy="45" r="7" fill="none" stroke={eyeColor} strokeWidth="1.5" opacity="0.5" />
          <line x1="39" y1="45" x2="41" y2="45" stroke={eyeColor} strokeWidth="1.5" opacity="0.5" />
        </>
      );
    case "headphone":
      return (
        <>
          <path d="M 22 38 Q 22 30 40 30 Q 58 30 58 38" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="18" y="38" width="7" height="10" rx="3" fill="#555" />
          <rect x="55" y="38" width="7" height="10" rx="3" fill="#555" />
        </>
      );
    case "magnifier":
      return (
        <>
          <circle cx="52" cy="18" r="5" fill="none" stroke="#666" strokeWidth="1.5" />
          <line x1="56" y1="22" x2="60" y2="26" stroke="#666" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case "crown":
      return <path d="M 30 18 L 34 10 L 40 16 L 46 10 L 50 18 L 48 22 L 32 22Z" fill="#FFD700" stroke="#F0A800" strokeWidth="0.5" />;
    case "wrench":
      return (
        <>
          <circle cx="52" cy="16" r="4" fill="none" stroke="#888" strokeWidth="1.5" />
          <line x1="55" y1="19" x2="60" y2="24" stroke="#888" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="49" y1="13" x2="46" y2="10" stroke="#888" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    default:
      return null;
  }
}

export default function AgentAvatar({ agentId, size = 72, className = "" }: AgentAvatarProps) {
  const config = avatarConfigs[agentId] ?? avatarConfigs[0];
  const scale = size / 80;

  const HairComponent = {
    twintails: HairTwintails,
    wavy: HairWavy,
    straight: HairStraight,
    spiky: HairSpiky,
    bob: HairBob,
    long: HairLong,
    shortbraid: HairShortBraid,
  }[config.hair] ?? HairTwintails;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className={className}
      style={{ overflow: "visible" }}
    >
      {/* 背景円 */}
      <circle cx="40" cy="40" r="40" fill={config.bgColor} />

      {/* 髪 (後ろ) */}
      <HairComponent color={config.hairColor} highlight={config.hairHighlight} />

      {/* 首 */}
      <rect x="33" y="65" width="14" height="8" rx="4" fill="#FFE0C8" />

      {/* 顔 */}
      <ellipse cx="40" cy="46" rx="18" ry="17" fill="#FFE0C8" />

      {/* 目 (白目) */}
      <circle cx="32" cy="45" r="6" fill="white" />
      <circle cx="48" cy="45" r="6" fill="white" />

      {/* 瞳 */}
      <circle cx="32" cy="46" r="4" fill={config.eyeColor} />
      <circle cx="48" cy="46" r="4" fill={config.eyeColor} />

      {/* 瞳ハイライト */}
      <circle cx="33.5" cy="44" r="1.5" fill="white" />
      <circle cx="49.5" cy="44" r="1.5" fill="white" />

      {/* まつ毛 */}
      <path d="M 27 40 Q 29 38 32 39" stroke={config.eyeColor} fill="none" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M 44 39 Q 47 38 53 40" stroke={config.eyeColor} fill="none" strokeWidth="1.2" strokeLinecap="round" />

      {/* ほっぺ */}
      <ellipse cx="22" cy="51" rx="5" ry="3" fill="#FFB3C6" opacity="0.55" />
      <ellipse cx="58" cy="51" rx="5" ry="3" fill="#FFB3C6" opacity="0.55" />

      {/* 口 */}
      <path d="M 35 57 Q 40 62 45 57" stroke="#D4849A" fill="none" strokeWidth="1.8" strokeLinecap="round" />

      {/* アクセサリー */}
      <Accessory type={config.accessory} eyeColor={config.eyeColor} />
    </svg>
  );
}
