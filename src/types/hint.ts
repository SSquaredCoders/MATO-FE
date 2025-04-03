export type HintItem = {
    id: number;
    text: string;
    revealTime: number;
};

export interface HintDto {
    id: number;
    mapSongId: number;
    text: string;
    revealTime: number;
}

export interface HintData {
    text: string;
    revealTime: number;
}

export interface HintRequest {
    mapSongId: number;
    hints: HintData[];
}

export interface HintResponse {
    id: number;
    mapSongId: number;
    text: string;
    revealTime: number;
}