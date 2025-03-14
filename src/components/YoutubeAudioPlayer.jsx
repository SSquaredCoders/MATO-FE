import React, { useState, useEffect, useRef } from "react";
import ReactPlayer from "react-player";

const YoutubeAudioPlayer = ({ videoUrl, startTime, endTime, repeatCount }) => {
    const [playing, setPlaying] = useState(false);
    const [playCount, setPlayCount] = useState(0);
    const playerRef = useRef(null);

    useEffect(() => {
        if (playCount >= repeatCount) {
            setPlaying(false);
        }
    }, [playCount, repeatCount]);

    const handleProgress = ({ playedSeconds }) => {
        if (playedSeconds >= endTime) {
            setPlayCount((prev) => prev + 1);
            playerRef.current.seekTo(startTime, "seconds"); // 시작 시간으로 이동
        }
    };

    return (
        <div>
            <ReactPlayer
                ref={playerRef}
                url={videoUrl}
                playing={playing}
                onProgress={handleProgress}
                volume={1}
                width="0"
                height="0" // 화면 숨김
            />
            <button onClick={() => setPlaying(!playing)}>
                {playing ? "⏸ 정지" : "▶ 재생"}
            </button>
        </div>
    );
};

export default YoutubeAudioPlayer;
