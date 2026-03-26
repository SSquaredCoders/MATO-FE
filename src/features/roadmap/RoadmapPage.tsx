import React from "react";

const phases = [
  {
    title: "1단계",
    body: "새 셸을 올리고 레거시 화면 트리를 교체합니다.",
  },
  {
    title: "2단계",
    body: "TanStack Query 기반의 /api/v2 로비 및 방 조회를 붙입니다.",
  },
  {
    title: "3단계",
    body: "단일 웹소켓 브리지와 스냅샷 봉투 구조를 구현합니다.",
  },
  {
    title: "4단계",
    body: "정답 제출, 점수 반영, 라운드 전환을 되살립니다.",
  },
  {
    title: "5단계",
    body: "안정된 핵심 루프 위에 맵 편집과 미디어 도구를 복구합니다.",
  },
];

export default function RoadmapPage() {
  return (
    <section className="panel stack">
      <p className="eyebrow">마이그레이션 단계</p>
      <h2>핵심 루프를 먼저 다시 만들고, 도구는 그 위에 얹습니다.</h2>
      <ol className="timeline">
        {phases.map((phase) => (
          <li key={phase.title}>
            <strong>{phase.title}</strong>
            <span>{phase.body}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
