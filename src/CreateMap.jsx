import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import YoutubeAudioPlayer from "./components/YoutubeAudioPlayer";

const CreateMap = () => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const [songs, setSongs] = useState([]);
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    const [composer, setComposer] = useState("");
    const [videoUrl, setVideoUrl] = useState("");
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(30);
    const [repeatCount, setRepeatCount] = useState(1);
    const navigate = useNavigate();

    // ✅ 맵 이름 중복 검사
    const checkDuplicateMap = async (name) => {
        const response = await fetch(`/api/maps/check?name=${name}`);
        return response.ok;
    };

    // ✅ 유튜브 URL 검증 (올바른 형식인지 확인)
    const isValidYoutubeUrl = (url) => {
        const youtubeRegex = /^(https?\:\/\/)?(www\.youtube\.com|youtu\.?be)\/.+$/;
        return youtubeRegex.test(url);
    };

    // ✅ 맵 생성 요청
    const handleSubmit = async (e) => {
        e.preventDefault();
        const userId = 1;

        if (await checkDuplicateMap(name)) {
            alert("이미 존재하는 맵 이름입니다!");
            return;
        }

        try {
            const response = await fetch("http://localhost:8080/api/maps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, description, isPublic, userId, songs }),
            });

            if (response.ok) {
                alert("맵 생성 완료! 🎉");
                navigate("/maps");
            } else {
                throw new Error("맵 생성 실패");
            }
        } catch (error) {
            alert("맵 생성 중 오류 발생 ❌");
            console.error(error);
        }
    };

    // ✅ 노래 추가 기능 (중복 방지 & 유효성 검사 추가)
    const handleAddSong = () => {
        if (!title || !artist || !videoUrl) {
            alert("노래 제목, 아티스트, 유튜브 URL을 입력해주세요.");
            return;
        }

        if (!isValidYoutubeUrl(videoUrl)) {
            alert("유효한 유튜브 URL을 입력해주세요.");
            return;
        }

        if (songs.some(song => song.videoUrl === videoUrl)) {
            alert("이미 추가된 노래입니다!");
            return;
        }

        setSongs([...songs, { title, artist, composer, videoUrl, startTime, endTime, repeatCount }]);

        // ✅ 입력 필드 초기화
        setTitle("");
        setArtist("");
        setComposer("");
        setVideoUrl("");
        setStartTime(0);
        setEndTime(30);
        setRepeatCount(1);
    };

    return (
        <div>
            <h2>맵 만들기</h2>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="맵 이름"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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
                placeholder="노래 제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
            />
            <input
                type="text"
                placeholder="아티스트"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                required
            />
            <input
                type="text"
                placeholder="작곡가 (선택)"
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
            />
            <input
                type="text"
                placeholder="유튜브 URL"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                required
            />
            <label>
                시작 시간 (초):
                <input
                    type="number"
                    value={startTime}
                    onChange={(e) => setStartTime(Number(e.target.value))}
                />
            </label>
            <label>
                종료 시간 (초):
                <input
                    type="number"
                    value={endTime}
                    onChange={(e) => setEndTime(Number(e.target.value))}
                />
            </label>
            <label>
                반복 횟수:
                <input
                    type="number"
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(Number(e.target.value))}
                />
            </label>
            <button onClick={handleAddSong}>노래 추가</button>

            {/* ✅ 유튜브 미리보기 기능 */}
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
                    <li key={index}>
                        {song.title} - {song.artist} (반복: {song.repeatCount}회)
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default CreateMap;
