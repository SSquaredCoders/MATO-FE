import { MapSongRequest, MapSongResponse } from './song';

export interface MapFormData {
    userId: string | number;
    name: string;
    description: string;
    isPublic: boolean;
    songs: MapSongRequest[];
}

export interface MapResponse {
    id: number;
    userId: string | number;
    name: string;
    description: string;
    isPublic: boolean;
    songs: MapSongResponse[];
    createdAt?: string;
    updatedAt?: string;
}
