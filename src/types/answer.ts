export type AnswerItem = {
    id: number;
    text: string;
};

// 백엔드 AnswerDto에 대응하는 인터페이스
export interface AnswerDto {
    id: number;
    mapSongId: number;
    answerText: string;
}

// 백엔드 AnswerRequestDto에 대응하는 인터페이스
export interface AnswerRequest {
    mapSongId: number;
    answerTexts: string[]; // 여러 정답을 한 번에 추가할 수 있음
}

// 백엔드 AnswerResponseDto에 대응하는 인터페이스
export interface AnswerResponse {
    id: number;
    mapSongId: number;
    answerText: string;
}


