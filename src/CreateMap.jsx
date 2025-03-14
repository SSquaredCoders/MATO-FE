import React, { useState } from "react";
import YoutubeAudioPlayer from "./components/YoutubeAudioPlayer";

const CreateMap = () => {
    const [mapName, setMapName] = useState("");
    const [description, setDescription] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const [songs, setSongs] = useState([]);
    const [videoUrl, setVideoUrl] = useState("");
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(30);
    const [repeatCount, setRepeatCount] = useState(1);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const mapResponse = await fetch("/api/maps", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mapName, description, isPublic }),
        });
        const mapData = await mapResponse.json();
        console.log("맵 생성 완료:", mapData);
    };

    const handleAddSong = () => {
        setSongs([...songs, { videoUrl, startTime, endTime, repeatCount }]);
        setVideoUrl(""); // 입력 필드 초기화
    };

    return (
        <div>
            <h2>맵 만들기</h2>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="맵 이름"
                    value={mapName}
                    onChange={(e) => setMapName(e.target.value)}
                    required
                />
                <textarea
                    placeholder="설명"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <label>
                    <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={() => setIsPublic(!isPublic)}
                    />
                    공개 여부
                </label>
                <button type="submit">맵 생성</button>
            </form>

            <h3>노래 추가</h3>
            <input
                type="text"
                placeholder="유튜브 URL"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                required
            />
            <label>
                시작 시간 (초):{" "}
                <input
                    type="number"
                    value={startTime}
                    onChange={(e) => setStartTime(Number(e.target.value))}
                />
            </label>
            <label>
                종료 시간 (초):{" "}
                <input
                    type="number"
                    value={endTime}
                    onChange={(e) => setEndTime(Number(e.target.value))}
                />
            </label>
            <label>
                반복 횟수:{" "}
                <input
                    type="number"
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(Number(e.target.value))}
                />
            </label>
            <button onClick={handleAddSong}>노래 추가</button>

            {/* 미리보기 */}
            {videoUrl && (
                <YoutubeAudioPlayer
                    videoUrl={videoUrl}
                    startTime={startTime}
                    endTime={endTime}
                    repeatCount={repeatCount}
                />
            )}

            <h3>추가된 노래 목록</h3>
            <ul>
                {songs.map((song, index) => (
                    <li key={index}>{song.videoUrl} (반복: {song.repeatCount}회)</li>
                ))}
            </ul>
        </div>
    );
};

export default CreateMap;
