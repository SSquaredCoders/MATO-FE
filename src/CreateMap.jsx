import React, { useState } from "react";
import SongForm from "./SongForm";
import SongList from "./SongList";

const API_BASE_URL = "http://localhost:8080/api";

const CreateMap = () => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const [songs, setSongs] = useState([]);

    const isSongDuplicateInMap = (title, artist) => {
        return songs.some(song => song.title === title && song.artist === artist);
    };

    const handleAddSong = async (newSong) => {
        if (isSongDuplicateInMap(newSong.title, newSong.artist)) {
            alert("현재 맵에 이미 추가된 노래입니다.");
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/songs/check?title=${encodeURIComponent(newSong.title)}&artist=${encodeURIComponent(newSong.artist)}`
            );
            const { isDuplicate } = await response.json();
            if (isDuplicate) {
                alert("서버에 이미 존재하는 노래입니다.");
                return;
            }
        } catch (error) {
            console.error("노래 중복 확인 실패:", error);
        }

        setSongs([...songs, newSong]);
    };

    const handleCreateMap = async () => {
        if (!name || songs.length === 0) {
            alert("맵 이름을 입력하고 최소 한 개의 노래를 추가하세요.");
            return;
        }

        try {
            const requestBody = {
                userId: 1,
                name,
                description,
                isPublic,
                songs: songs.map(song => ({
                    songId: song.id,
                    startTime: song.startTime ?? 0,
                    endTime: song.endTime ?? 30,
                    repeatCount: song.repeatCount ?? 1
                }))
            };

            const response = await fetch(`${API_BASE_URL}/maps`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                alert(errorData.message || "맵 생성 실패 (서버 오류)");
                return;
            }

            alert("맵이 생성되었습니다.");
            setName("");
            setDescription("");
            setIsPublic(true);
            setSongs([]);
        } catch (error) {
            alert("맵 생성 중 오류 발생.");
        }
    };

    return (
        <div>
            <h2>맵 만들기</h2>
            <input type="text" placeholder="맵 이름" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea placeholder="설명" value={description} onChange={(e) => setDescription(e.target.value)} />
            <label>
                <input type="checkbox" checked={isPublic} onChange={() => setIsPublic(!isPublic)} /> 공개 여부
            </label>
            <button onClick={handleCreateMap}>맵 생성</button>

            <SongForm onAddSong={handleAddSong} />
            <SongList songs={songs} setSongs={setSongs} />
        </div>
    );
};

export default CreateMap;
