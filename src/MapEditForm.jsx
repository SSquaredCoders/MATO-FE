import { useState, useEffect } from "react";
import SongForm from "./SongForm";
import PropTypes from "prop-types";

const API_BASE_URL = "http://localhost:8080/api";

const MapEditForm = ({ map, onEditComplete }) => {
    const [name, setName] = useState(map.name ?? "");
    const [description, setDescription] = useState(map.description ?? "");
    const [songs, setSongs] = useState([]);
    const [editingSong, setEditingSong] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);


    useEffect(() => {
        const fetchSongs = async () => {
            if (!map.id) {
                console.error("❌ 오류: map.id가 없습니다!");
                return;
            }
            try {
                console.log(`📡 Fetching songs for map ID: ${map.id}`);
                const response = await fetch(`${API_BASE_URL}/maps/${map.id}/songs`);
                if (!response.ok) {
                    throw new Error("노래 목록을 불러오는 데 실패했습니다.");
                }
                const data = await response.json();
                console.log("✅ 불러온 노래 목록:", data);

                // MapSongResponseDto 구조에서 song 데이터를 추출하여 songs 상태 업데이트
                setSongs(data.map(mapSong => ({
                    id: mapSong.songId,
                    title: mapSong.title,
                    artist: mapSong.artist,
                    startTime: mapSong.startTime,
                    endTime: mapSong.endTime,
                    repeatCount: mapSong.repeatCount,
                    youtubeUrl: mapSong.audioUrl
                })));
            } catch (err) {
                console.error("❌ API 오류:", err);
                setError(err.message);
            }
        };
        fetchSongs();
    }, [map.id]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/maps/${map.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, description, songs })
            });
            if (!response.ok) {
                throw new Error("맵 수정 실패");
            }
            console.log("✅ 맵 수정 성공!");
            onEditComplete();
        } catch (err) {
            console.error("❌ 맵 수정 오류:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddSong = async (newSong) => {
        if (!map.id) {
            console.error("❌ 오류: map.id가 없습니다!");
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/maps/${map.id}/songs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    songId: newSong.id,
                    startTime: newSong.startTime,
                    endTime: newSong.endTime,
                    repeatCount: newSong.repeatCount
                })
            });

            if (!response.ok) {
                throw new Error("노래 추가 실패");
            }

            console.log("✅ 노래 추가 성공:", newSong);
            setSongs([...songs, newSong]); // UI 업데이트
        } catch (err) {
            console.error("❌ 노래 추가 오류:", err);
        }
    };

    const handleEditSongSelect = (song) => {
        setEditingSong(song);
    };

    return (
        <div>
            <h3>맵 수정</h3>
            {error && <p style={{ color: "red" }}>{error}</p>}
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            <button onClick={handleSave} disabled={loading}>{loading ? "저장 중..." : "저장"}</button>

            <h3>노래 목록</h3>
            {songs.length === 0 ? (
                <p>추가된 노래가 없습니다.</p>
            ) : (
                <ul>
                    {songs.map((song) => (
                        <li key={song.id} onClick={() => handleEditSongSelect(song)}>
                            {song.title} - {song.artist} ({Math.floor(song.startTime / 60)}:{String(song.startTime % 60).padStart(2, '0')} - {Math.floor(song.endTime / 60)}:{String(song.endTime % 60).padStart(2, '0')})
                        </li>
                    ))}
                </ul>
            )}

            <h3>노래 추가 / 수정</h3>
            <SongForm existingSong={editingSong} onAddSong={handleAddSong} />
        </div>
    );
};

MapEditForm.propTypes = {
    map: PropTypes.shape({
        id: PropTypes.number.isRequired,
        name: PropTypes.string,
        description: PropTypes.string,
    }),
    onEditComplete: PropTypes.func.isRequired,
};

export default MapEditForm;
