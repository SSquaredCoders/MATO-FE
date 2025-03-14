// 📂 api/mapApi.js
export const createMap = async (mapData) => {
    const response = await fetch("/api/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapData),
    });
    return response.json();
};

export const addSongToMap = async (mapId, songData) => {
    const response = await fetch(`/api/maps/${mapId}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(songData),
    });
    return response.json();
};
