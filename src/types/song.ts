import {AnswerItem} from "./answer";
import {HintItem} from "./hint";

export type SongItem = {
    id: number; // MapSong ID
    songId: number; // 실제 Song ID
    title: string;
    youtubeUrl: string;
    startTime: number;
    endTime: number;
    repeatCount: number;
    answers: AnswerItem[];
    hints: HintItem[];
};

// 백엔드 SongRequestDto에 대응하는 인터페이스
export interface SongRequest {
    youtubeUrl: string;  // 오디오 URL (유튜브 링크 OR 업로드된 파일)
    title: string;
}

// 백엔드 SongResponseDto에 대응하는 인터페이스
export interface SongResponse {
    id: number;
    youtubeUrl: string;
    title: string;
    createdAt?: string;
    updatedAt?: string;
}

// 백엔드 MapSongRequestDto에 대응하는 인터페이스
export interface MapSongRequest {
    songId?: number;       // 노래 ID (기존 노래 사용 시)
    newSong?: SongRequest; // 새로운 노래 정보 (신규 노래 추가 시)
    startTime: number;     // 시작 시점 (초 단위)
    endTime: number;       // 종료 시점 (초 단위)
    repeatCount: number;   // 반복 횟수 (최소 1번)
}

// 백엔드 MapSongResponseDto에 대응하는 인터페이스
export interface MapSongResponse {
    id: number;
    mapId: number;
    songId: number;
    startTime: number;
    endTime: number;
    repeatCount: number;
    song: SongResponse;
    answers: AnswerItem[];
    hints: HintItem[];
}
