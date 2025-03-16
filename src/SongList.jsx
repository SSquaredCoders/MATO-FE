import React from "react";

const API_BASE_URL = "http://localhost:8080/api";

const SongList = ({ songs, setSongs }) => {
    const handleDeleteSong = async (songId) => {
        if (!window.confirm("정말 이 노래를 삭제하시겠습니까?")) return;
        try {
            const response = await fetch(`${API_BASE_URL}/songs/${songId}`, { method: "DELETE" });
            if (!response.ok) throw new Error("노래 삭제 실패");
            setSongs(songs.filter(song => song.id !== songId));
        } catch (error) {
            alert("노래 삭제 중 오류 발생.");
        }
    };

    return (
        <div>
            <h3>추가된 노래 목록</h3>
            <ul>
                {songs.map(song => (
                    <li key={song.id}>
                        {song.title} - {song.artist}
                        <button onClick={() => handleDeleteSong(song.id)}>삭제</button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default SongList;