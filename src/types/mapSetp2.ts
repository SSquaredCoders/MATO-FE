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
        answers: { id: number; text: string }[];
        hints: { id: number; text: string; revealTime: number }[];
    }[];
}
