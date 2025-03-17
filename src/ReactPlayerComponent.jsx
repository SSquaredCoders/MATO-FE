import { useRef, useEffect } from "react";
import ReactPlayer from "react-player";
import PropTypes from "prop-types";

const ReactPlayerComponent = ({ youtubeUrl, startTime, endTime, repeatCount, onTimeUpdate }) => {
    const playerRef = useRef(null);
    const repeatRef = useRef(repeatCount);

    useEffect(() => {
        repeatRef.current = repeatCount;
    }, [repeatCount]);

    useEffect(() => {
        if (playerRef.current && playerRef.current.getInternalPlayer()) {
            playerRef.current.seekTo(startTime, "seconds");
        }
    }, [startTime, youtubeUrl]);

    const handleReady = () => {
        if (playerRef.current) {
            playerRef.current.seekTo(startTime, "seconds");
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
        onTimeUpdate(playedSeconds);
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
            onReady={handleReady}
        />
    );
};

ReactPlayerComponent.propTypes = {
    youtubeUrl: PropTypes.string.isRequired,
    startTime: PropTypes.number.isRequired,
    endTime: PropTypes.number.isRequired,
    repeatCount: PropTypes.number.isRequired,
    onTimeUpdate: PropTypes.func.isRequired
};

export default ReactPlayerComponent;
