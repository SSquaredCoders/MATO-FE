import { useState, type ReactNode } from "react";

export const MAP_STEPS = [
  { id: "basics", label: "기본 정보" },
  { id: "songs", label: "곡 담기" },
  { id: "answers", label: "곡별 정답" },
  { id: "rules", label: "게임 규칙" },
  { id: "review", label: "확인 및 저장" },
] as const;

export type MapStep = (typeof MAP_STEPS)[number]["id"];

export function MapWizard({
  step, editing, disabled, auxiliary, onStep, onNext, onSave, children,
}: {
  step: MapStep;
  editing: boolean;
  disabled: boolean;
  auxiliary: boolean;
  onStep: (step: MapStep) => void;
  onNext: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  const index = MAP_STEPS.findIndex(({ id }) => id === step);
  return (
    <section className="map-wizard" aria-labelledby="map-wizard-heading">
      <nav aria-label="맵 편집 단계">
        <ol className="map-wizard__steps">
          {MAP_STEPS.map(({ id, label }, position) => (
            <li key={id} aria-current={id === step ? "step" : undefined}>
              {editing ? (
                <button type="button" disabled={disabled} onClick={() => onStep(id)}>
                  {position + 1}. {label}
                </button>
              ) : <span>{position + 1}. {label}</span>}
            </li>
          ))}
        </ol>
      </nav>
      <h2 id="map-wizard-heading">{MAP_STEPS[index].label}</h2>
      <div className="map-wizard__body">{children}</div>
      {!auxiliary && <div className="map-wizard__footer">
        {index > 0 && (
          <button type="button" className="button button--ghost" disabled={disabled}
            onClick={() => onStep(MAP_STEPS[index - 1].id)}>이전</button>
        )}
        {step === "review" ? (
          <button type="button" className="button" disabled={disabled} onClick={onSave}>
            {editing ? "변경 저장" : "맵 만들기"}
          </button>
        ) : (
          <button type="button" className="button" disabled={disabled} onClick={onNext}>
            {step === "rules" ? "확인 단계로" : "다음"}
          </button>
        )}
      </div>}
    </section>
  );
}

type AnswerSource = "title" | "artist" | "work";
type YoutubeEntry = Record<AnswerSource, string> & {
  youtubeUrl: string;
  success: boolean;
  answerType: AnswerSource[];
};
const SOURCE_LABELS = { title: "제목", artist: "가수", work: "작품" } as const;
const SOURCES = ["title", "artist", "work"] as const;

export function YoutubeImportResults({ entries, onChange, onToggle, onRemove, onAdd, onBack }: {
  entries: YoutubeEntry[];
  onChange: (index: number, field: AnswerSource, value: string) => void;
  onToggle: (index: number, field: AnswerSource) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  onBack: () => void;
}) {
  const [position, setPosition] = useState(0);
  const index = Math.min(position, entries.length - 1);
  const entry = entries[index];
  if (!entry) return null;
  const ready = entries.filter((item) => item.success && item.answerType.length > 0).length;
  return (
    <section className="map-wizard__track" aria-label="유튜브 조회 결과">
      <div className="map-wizard__tools">
        <strong>조회 결과 {index + 1}/{entries.length}</strong>
        <button type="button" disabled={index === 0} onClick={() => setPosition(index - 1)}>이전 결과</button>
        <button type="button" disabled={index === entries.length - 1} onClick={() => setPosition(index + 1)}>다음 결과</button>
      </div>
      <p>{entry.success ? entry.youtubeUrl : `조회 실패: ${entry.youtubeUrl}`}</p>
      {entry.success && <>
        {SOURCES.map((field) => (
          <label className="field" key={field}>
            <span>{SOURCE_LABELS[field]}</span>
            <input value={entry[field]} onChange={(event) => onChange(index, field, event.target.value)} />
          </label>
        ))}
        <div className="map-wizard__tools" role="group" aria-label="정답으로 사용할 항목">
          {SOURCES.map((field) => <button key={field} type="button" aria-pressed={entry.answerType.includes(field)}
            onClick={() => onToggle(index, field)}>{SOURCE_LABELS[field]}을 정답에 포함</button>)}
        </div>
      </>}
      <div className="map-wizard__tools">
        <button type="button" onClick={() => onRemove(index)}>이 결과 삭제</button>
        <button type="button" onClick={onBack}>링크 입력으로</button>
        <button className="button" type="button" disabled={!ready} onClick={onAdd}>{ready}곡 담기</button>
      </div>
    </section>
  );
}

export function MapSongRow({
  title, position, total, onOpen, onMove, onDuplicate, onRemove,
}: {
  title: string;
  position: number;
  total: number;
  onOpen: () => void;
  onMove: (index: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="map-wizard__song-row">
      <button className="map-wizard__song-title" type="button" onClick={onOpen} title={title}>
        {position + 1}. {title}
      </button>
      <details className="map-wizard__row-menu">
        <summary aria-label={`${position + 1}번 곡 관리`}>⋯</summary>
        <div className="map-wizard__row-actions" onClick={(event) => {
          if (event.target instanceof HTMLButtonElement) {
            const menu = event.currentTarget.closest("details");
            if (menu) menu.open = false;
          }
        }}>
          <button type="button" onClick={onDuplicate}>복제</button>
          <button type="button" disabled={position === 0} onClick={() => onMove(0)}>맨 위</button>
          <button type="button" disabled={position === 0} onClick={() => onMove(position - 1)}>위로</button>
          <button type="button" disabled={position === total - 1} onClick={() => onMove(position + 1)}>아래로</button>
          <button type="button" disabled={position === total - 1} onClick={() => onMove(total - 1)}>맨 아래</button>
          <button type="button" onClick={onRemove}>곡 삭제</button>
        </div>
      </details>
    </li>
  );
}
