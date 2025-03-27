export type HintItem = {
    id: number;
    text: string;
    revealTime: number;
};

export interface HintDto {
    id: number;
    mapSongId: number;
    hintText: string;
    hintTime: number;
}

export interface HintData {
    hintText: string;
    revealTime: number;
}

export interface HintRequest {
    mapSongId: number;
    hints: HintData[];
}

export interface HintResponse {
    id: number;
    mapSongId: number;
    hintText: string;
    revealTime: number;
}