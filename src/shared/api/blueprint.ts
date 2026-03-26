import type { ClientEventType, ServerEventType } from "../types/contracts";

export interface BlueprintSection {
  title: string;
  description: string;
  bullets: string[];
}

export interface RebuildBlueprint {
  principles: BlueprintSection[];
  frontendTree: string[];
  restRoutes: string[];
  clientEvents: ClientEventType[];
  serverEvents: ServerEventType[];
  implementationOrder: string[];
}

const blueprint: RebuildBlueprint = {
  principles: [
    {
      title: "서버 권한 집중",
      description:
        "백엔드가 방 인원, 점수, 라운드 순서, 승자 계산을 단일 책임으로 가집니다.",
      bullets: [
        "클라이언트 정답 테이블 제거",
        "스냅샷 기반 방 렌더링",
        "경합 상황을 한곳에서 처리",
      ],
    },
    {
      title: "얇은 클라이언트 상태",
      description:
        "클라이언트는 화면 상태와 일시적인 상호작용 상태만 보관합니다.",
      bullets: [
        "REST 상태는 TanStack Query",
        "로컬 세션 상태는 Zustand",
        "기능별 중복 context 제거",
      ],
    },
    {
      title: "단일 실시간 계약",
      description:
        "v2는 흩어진 토픽과 임시 메시지 대신 하나의 이벤트 봉투 구조를 사용합니다.",
      bullets: [
        "방 스냅샷 복원",
        "타입이 고정된 이벤트 이름",
        "재시도 로직을 단일 소켓 브리지에 격리",
      ],
    },
  ],
  frontendTree: [
    "app/providers",
    "app/layout",
    "features/lobby",
    "features/room",
    "features/maps",
    "features/account",
    "shared/api",
    "shared/store",
    "shared/types",
  ],
  restRoutes: [
    "GET /api/v2/lobby/rooms",
    "POST /api/v2/rooms",
    "GET /api/v2/rooms/{roomName}",
    "POST /api/v2/rooms/{roomName}/join",
    "POST /api/v2/rooms/{roomName}/leave",
    "POST /api/v2/rooms/{roomName}/ready",
    "POST /api/v2/rooms/{roomName}/start",
    "POST /api/v2/rooms/{roomName}/answer",
  ],
  clientEvents: [
    "room.join",
    "room.leave",
    "room.ready.set",
    "game.start",
    "game.answer.submit",
    "game.next.request",
    "presence.ping",
  ],
  serverEvents: [
    "room.snapshot",
    "room.participant.changed",
    "game.phase.changed",
    "game.round.started",
    "game.answer.accepted",
    "game.answer.rejected",
    "game.score.changed",
    "game.finished",
    "error",
  ],
  implementationOrder: [
    "새 셸과 라우트를 먼저 정리",
    "방 화면을 단일 세션 상태와 소켓 브리지로 교체",
    "/api/v2 로비 및 방 조회 노출",
    "웹소켓 스냅샷 계약 구현",
    "정답 제출과 점수 반영을 종단 간 연결",
  ],
};

export async function fetchRebuildBlueprint(): Promise<RebuildBlueprint> {
  return blueprint;
}
