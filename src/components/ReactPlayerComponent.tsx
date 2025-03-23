// components/ReactPlayerComponent.tsx
import React, { useRef, useState, useEffect } from "react";
import ReactPlayer from "react-player";

interface Props {
    url: string;
    startTime: number;
    endTime: number;
    repeatCount: number;
}

const ReactPlayerComponent = ({ url, startTime, endTime, repeatCount }: Props) => {
    const playerRef = useRef<ReactPlayer>(null);
    const [currentRepeat, setCurrentRepeat] = useState(1);
    const [playing, setPlaying] = useState(true);

    // 플레이어가 준비되면 startTime으로 이동
    useEffect(() => {
        if (playerRef.current) {
            playerRef.current.seekTo(startTime, "seconds");
        }
    }, [startTime, url]);

    const handleProgress = (state: { playedSeconds: number }) => {
        if (state.playedSeconds >= endTime) {
            if (currentRepeat < repeatCount) {
                playerRef.current?.seekTo(startTime, "seconds");
                setCurrentRepeat((prev) => prev + 1);
            } else {
                setPlaying(false); // 반복 완료 후 정지
            }
        }
    };

    return (
        <div className="aspect-video w-full mt-4">
            <ReactPlayer
                ref={playerRef}
                url={url}
                controls
                playing={playing}
                width="100%"
                height="100%"
                onProgress={handleProgress}
                config={{
                    youtube: {
                        playerVars: {
                            start: startTime,
                            end: endTime,
                        },
                    },
                }}
            />
        </div>
    );
};

export default ReactPlayerComponent;
