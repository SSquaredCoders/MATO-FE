import React, { useRef, useEffect } from "react";
import ReactPlayer from "react-player";

const ReactPlayerComponent = ({ youtubeUrl, startTime, endTime, repeatCount }) => {
    const playerRef = useRef(null);
    const repeatRef = useRef(repeatCount);

    useEffect(() => {
        repeatRef.current = repeatCount; // repeatCount 값 동기화
    }, [repeatCount]);

    useEffect(() => {
        if (playerRef.current && playerRef.current.getInternalPlayer()) {
            playerRef.current.seekTo(startTime, "seconds"); // 시작 시간으로 이동
        }
    }, [startTime, youtubeUrl]);

    const handleReady = () => {
        if (playerRef.current) {
            playerRef.current.seekTo(startTime, "seconds"); // onReady 시에도 적용
        }
    };

    const handleProgress = ({ playedSeconds }) => {
        if (playedSeconds >= endTime) {
            if (repeatRef.current > 1) {
                playerRef.current.seekTo(startTime, "seconds");
                repeatRef.current -= 1;
            } else {
                playerRef.current.pause();
            }
        }
    };

    return (
        <ReactPlayer
            ref={playerRef}
            url={youtubeUrl}
            controls
            width="100%"
            height="200px"
            playing
            config={{
                youtube: {
                    playerVars: { origin: window.location.origin, enablejsapi: 1 }
                }
            }}
            onProgress={handleProgress}
        />

    );
};

export default ReactPlayerComponent;
