import { useState } from "react";
import ReactPlayerComponent from "./ReactPlayerComponent";
import PropTypes from "prop-types";

const API_BASE_URL = "http://localhost:8080/api";

const SongForm = ({ songs, setSongs }) => {
    const [songTitle, setSongTitle] = useState("");
    const [artist, setArtist] = useState("");
    const [composer, setComposer] = useState("");
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [startTimeMinutes, setStartTimeMinutes] = useState(0);
    const [startTimeSeconds, setStartTimeSeconds] = useState(0);
    const [endTimeMinutes, setEndTimeMinutes] = useState(0);
    const [endTimeSeconds, setEndTimeSeconds] = useState(30);
    const [repeatCount, setRepeatCount] = useState(1);

    const startTime = startTimeMinutes * 60 + startTimeSeconds;
    const endTime = endTimeMinutes * 60 + endTimeSeconds;

    SongForm.propTypes = {
        songs: PropTypes.array.isRequired,
        setSongs: PropTypes.func.isRequired,
    };

    const handleAddSong = async () => {
        if (!songTitle || !artist || !youtubeUrl) {
            alert("노래 제목, 아티스트, URL을 입력하세요.");
            return;
        }

        // 🔥 youtubeUrl로만 중복 체크
        if (songs.some(song => song.youtubeUrl === youtubeUrl)) {
            alert("이미 이 맵에 추가된 YouTube URL입니다.");
            return;
        }

        const newSong = {
            title: songTitle,
            artist,
            composer,
            youtubeUrl,
            startTime,
            endTime,
            repeatCount
        };

        try {
            const response = await fetch(`${API_BASE_URL}/songs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newSong),
            });

            if (!response.ok) {
                throw new Error("노래 추가 실패");
            }

            const addedSong = await response.json();
            setSongs([...songs, addedSong]);

            // 폼 초기화
            setSongTitle("");
            setArtist("");
            setComposer("");
            setYoutubeUrl("");
            setStartTimeMinutes(0);
            setStartTimeSeconds(0);
            setEndTimeMinutes(0);
            setEndTimeSeconds(30);
            setRepeatCount(1);

            alert("노래가 추가되었습니다.");
        } catch (err) {
            console.error(err);
            alert("노래 추가 중 오류 발생");
        }
    };

    return (
        <div>
            <h3>노래 추가</h3>
            <input type="text" placeholder="노래 제목" value={songTitle} onChange={(e) => setSongTitle(e.target.value)} />
            <input type="text" placeholder="아티스트" value={artist} onChange={(e) => setArtist(e.target.value)} />
            <input type="text" placeholder="작곡가 (선택)" value={composer} onChange={(e) => setComposer(e.target.value)} />
            <input type="text" placeholder="유튜브 URL" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />

            <ReactPlayerComponent
                youtubeUrl={youtubeUrl}
                startTime={startTime}
                endTime={endTime}
                repeatCount={repeatCount}
            />

            <label>
                시작 시간:
                <input type="number" min="0" value={startTimeMinutes} onChange={(e) => setStartTimeMinutes(Number(e.target.value))} />분
                <input type="number" min="0" max="59" value={startTimeSeconds} onChange={(e) => setStartTimeSeconds(Number(e.target.value))} />초
            </label>
            <label>
                종료 시간:
                <input type="number" min="0" value={endTimeMinutes} onChange={(e) => setEndTimeMinutes(Number(e.target.value))} />분
                <input type="number" min="0" max="59" value={endTimeSeconds} onChange={(e) => setEndTimeSeconds(Number(e.target.value))} />초
            </label>
            <label>
                반복 횟수:
                <input type="number" min="1" value={repeatCount} onChange={(e) => setRepeatCount(Number(e.target.value))} />
            </label>

            <button onClick={handleAddSong}>노래 추가</button>
        </div>
    );
};

export default SongForm;
