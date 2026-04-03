import React from "react";

const guideSections = [
  {
    title: "계정",
    body: "로그인 후 맵을 만들면 작성자 정보가 자동으로 연결됩니다. 비로그인 상태에서도 닉네임을 입력해 방에는 참가할 수 있습니다.",
  },
  {
    title: "맵",
    body: "맵 화면에서 곡, 힌트, 정답, 재생 구간을 정리합니다. 음원은 유튜브 링크 또는 파일 업로드로 준비할 수 있습니다.",
  },
  {
    title: "방",
    body: "로비에서 방 이름과 시작 맵을 고른 뒤 새 방을 만들 수 있습니다. 참가자들이 준비를 마치면 방장이 게임을 시작합니다.",
  },
  {
    title: "진행",
    body: "정답 판정과 점수, 다음 곡 진행은 서버 기준으로 처리됩니다. 방 설정에서 라운드 시간, 스킵 규칙, 힌트 공개 시점을 조절할 수 있습니다.",
  },
];

export default function RoadmapPage() {
  return (
    <section className="panel stack">
      <p className="eyebrow">이용 안내</p>
      <h2>맵을 만들고, 방을 열고, 바로 플레이를 시작하는 흐름으로 준비했습니다.</h2>
      <p className="lede">
        처음이라면 맵 하나를 먼저 만든 뒤 로비에서 새 방을 열어 보세요. 주요 기능은 아래 순서대로
        확인하면 가장 자연스럽습니다.
      </p>
      <ol className="timeline">
        {guideSections.map((section) => (
          <li key={section.title}>
            <strong>{section.title}</strong>
            <span>{section.body}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
