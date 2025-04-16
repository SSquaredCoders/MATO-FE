// components/ReactPlayerComponent.tsx
import React, { useRef, useState, useEffect } from "react";
import ReactPlayer from "react-player";

interface Props {
    url: string;
    startTime?: number;
    endTime?: number;
    repeatCount?: number;
    muted?: boolean;
    volume?: number;
    visible?: boolean;
}

const ReactPlayerComponent = ({ 
    url, 
    startTime = 0, 
    endTime = 60, 
    repeatCount = 1,
    muted = true,
    volume = 80,
    visible = true
}: Props) => {
    const playerRef = useRef<ReactPlayer>(null);
    const [currentRepeat, setCurrentRepeat] = useState(1);
    const [playing, setPlaying] = useState(true);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<any>(null);

    // 노래 URL 변경 시 로그 출력
    useEffect(() => {
        console.log("노래 URL이 로드됨:", url);
        if (!url) console.warn("URL이 비어 있음!");
        setError(null);
        setReady(false);
    }, [url]);

    // 플레이어가 준비되면 startTime으로 이동
    useEffect(() => {
        if (playerRef.current && ready) {
            console.log("플레이어가 준비됨, 시작 시간으로 이동:", startTime);
            playerRef.current.seekTo(startTime, "seconds");
        }
    }, [startTime, url, ready]);

    const handleReady = () => {
        console.log("플레이어 준비 완료");
        setReady(true);
        if (playerRef.current) {
            playerRef.current.seekTo(startTime, "seconds");
        }
    };

    const handlePlay = () => {
        console.log("노래 재생 시작됨");
    };

    const handleError = (error: any) => {
        console.error("플레이어 오류 발생:", error);
        setError(error);
    };

    const handleProgress = (state: { playedSeconds: number }) => {
        if (state.playedSeconds >= endTime) {
            if (currentRepeat < repeatCount) {
                console.log(`반복 재생: ${currentRepeat}/${repeatCount}`);
                playerRef.current?.seekTo(startTime, "seconds");
                setCurrentRepeat((prev) => prev + 1);
            } else {
                console.log("모든 반복 완료, 재생 중지");
                setPlaying(false); // 반복 완료 후 정지
            }
        }
    };

    return (
        <div className="aspect-video w-full mt-4">
            {error && (
                <div className="text-red-500 mb-2 text-center">
                    재생 오류 발생: {error.toString()}
                </div>
            )}
            
            {!url && (
                <div className="text-yellow-500 mb-2 text-center">
                    재생할 URL이 없습니다
                </div>
            )}
            
            <div style={{ display: visible ? 'block' : 'none' }}>
                <ReactPlayer
                    ref={playerRef}
                    url={url}
                    controls
                    playing={playing}
                    muted={muted}
                    volume={volume / 100}
                    width="100%"
                    height="100%"
                    onReady={handleReady}
                    onPlay={handlePlay}
                    onError={handleError}
                    onProgress={handleProgress}
                    config={{
                        youtube: {
                            playerVars: {
                                start: startTime,
                                end: endTime,
                                autoplay: 1,
                            },
                        },
                    }}
                />
            </div>
            
            {visible && (
                <div className="mt-2 text-sm text-gray-500 text-center">
                    {playing ? "재생 중" : "정지됨"} • 
                    반복: {currentRepeat}/{repeatCount} • 
                    {muted ? "음소거됨 (볼륨 버튼을 눌러 음소거를 해제하세요)" : `볼륨: ${volume}%`}
                </div>
            )}
        </div>
    );
};

export default ReactPlayerComponent;
