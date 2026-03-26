import React from "react";

const pipeline = [
  "맵 메타데이터는 REST에 두고 적극적으로 캐시합니다.",
  "라운드 재생 자산은 방 생성 전에 정규화합니다.",
  "맵 편집은 방/게임 루프가 안정된 뒤 다시 붙입니다.",
];

export default function MapsPage() {
  return (
    <div className="grid grid--two">
      <section className="panel stack">
        <p className="eyebrow">맵 파이프라인</p>
        <h2>맵 기능은 핵심 게임 루프와 분리합니다.</h2>
        <p className="lede">
          v2에서는 맵 작성 기능을 방 런타임에서 분리합니다. 방 화면은 요약 메타데이터와
          서버가 승인한 라운드 프롬프트만 있으면 됩니다.
        </p>
        <ul className="list">
          {pipeline.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <p className="eyebrow">후순위 범위</p>
        <h2>에디터, 업로드, 미디어 복구는 나중에 붙입니다.</h2>
        <p className="footnote">
          이렇게 해야 첫 번째 v2 마일스톤이 모든 도구를 한 번에 다시 만드는 대신,
          안정성에 집중할 수 있습니다.
        </p>
      </section>
    </div>
  );
}
