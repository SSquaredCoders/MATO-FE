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
