export interface MapItem {
    id: number;
    name: string;
    description: string;
    isPublic: boolean;
    songs: {
        id: number; // MapSong ID
        song: {
            id: number;
            title: string;
            youtubeUrl: string;
        };
        startTime: number;
        endTime: number;
        repeatCount: number;
        answers: { id: number; answerText: string }[];
        hints: { id: number; hintText: string; revealTime: number }[];
    }[];
}
