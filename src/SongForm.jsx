import React, { useState } from "react";
import ReactPlayerComponent from "./ReactPlayerComponent";

const API_BASE_URL = "http://localhost:8080/api";

const SongForm = ({ onAddSong }) => {
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

    const handleTimeChange = (setterMinutes, setterSeconds, value, isMinutes) => {
        const numValue = Number(value);
        if (isMinutes) {
            setterMinutes(numValue);
        } else {
            setterSeconds(numValue);
        }
    };

    const handleAddSong = async () => {
        if (!songTitle || !artist || !youtubeUrl) {
            alert("노래 제목, 아티스트, URL을 입력하세요.");
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

        onAddSong(newSong);
        setSongTitle("");
        setArtist("");
        setComposer("");
        setYoutubeUrl("");
        setStartTimeMinutes(0);
        setStartTimeSeconds(0);
        setEndTimeMinutes(0);
        setEndTimeSeconds(30);
        setRepeatCount(1);
    };

    return (
        <div>
            <h3>노래 추가</h3>
            <input type="text" placeholder="노래 제목" value={songTitle} onChange={(e) => setSongTitle(e.target.value)} />
            <input type="text" placeholder="아티스트" value={artist} onChange={(e) => setArtist(e.target.value)} />
            <input type="text" placeholder="유튜브 URL" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
            <ReactPlayerComponent youtubeUrl={youtubeUrl} startTime={startTime} endTime={endTime} repeatCount={repeatCount} />

            <label>
                시작 시간:
                <input type="number" min="0" value={startTimeMinutes} onChange={(e) => handleTimeChange(setStartTimeMinutes, setStartTimeSeconds, e.target.value, true)} /> 분
                <input type="number" min="0" max="59" value={startTimeSeconds} onChange={(e) => handleTimeChange(setStartTimeMinutes, setStartTimeSeconds, e.target.value, false)} /> 초
            </label>
            <label>
                종료 시간:
                <input type="number" min="0" value={endTimeMinutes} onChange={(e) => handleTimeChange(setEndTimeMinutes, setEndTimeSeconds, e.target.value, true)} /> 분
                <input type="number" min="0" max="59" value={endTimeSeconds} onChange={(e) => handleTimeChange(setEndTimeMinutes, setEndTimeSeconds, e.target.value, false)} /> 초
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
