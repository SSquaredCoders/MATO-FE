import { useEffect, useRef, useState } from "react";
import { ensureYouTubeApi, getYouTubeVideoId, resolveMediaUrl } from "../maps/utils";
import type { YouTubePlayer } from "../maps/types";

type PlaybackState = "loading" | "playing" | "paused" | "blocked" | "error";
const labels: Record<PlaybackState, string> = {
  loading: "음원 불러오는 중",
  playing: "음악 재생 중",
  paused: "일시정지",
  blocked: "자동재생이 차단됐습니다.",
  error: "음원을 재생할 수 없습니다.",
};

export default function RoomPlayback({ source, type, start, end, visible, volume, endsAt }: {
  source: string;
  type: "youtube" | "file";
  start: number;
  end: number | null;
  visible: boolean;
  volume: number;
  endsAt: number | null;
}) {
  const [state, setState] = useState<PlaybackState>("loading");
  const audio = useRef<HTMLAudioElement>(null);
  const youtube = useRef<YouTubePlayer | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const currentVolume = useRef(volume);
  const deadline = useRef(endsAt);
  const ready = useRef(false);
  const videoId = type === "youtube" ? getYouTubeVideoId(source) : null;
  const active = () => deadline.current === null || Date.now() < deadline.current;
  const updateVolume = () => {
    if (audio.current) audio.current.volume = currentVolume.current / 100;
    if (ready.current) {
      youtube.current?.setVolume?.(currentVolume.current);
      if (currentVolume.current > 0) youtube.current?.unMute?.();
    }
  };
  const playFile = (element: HTMLAudioElement) => {
    if (!active()) return;
    void element.play().catch((error: unknown) => {
      if (!element.isConnected || (error instanceof DOMException && error.name === "AbortError")) return;
      setState(error instanceof DOMException && error.name === "NotAllowedError" ? "blocked" : "error");
    });
  };

  useEffect(() => {
    currentVolume.current = volume;
    updateVolume();
  }, [volume]);

  useEffect(() => {
    deadline.current = endsAt;
    if (endsAt === null) return;
    const timer = window.setTimeout(() => {
      audio.current?.pause();
      if (ready.current) youtube.current?.pauseVideo();
    }, Math.max(0, endsAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [endsAt]);

  useEffect(() => {
    if (type !== "youtube" || !videoId || !frame.current) return;
    const element = frame.current;
    let disposed = false;
    const timeout = window.setTimeout(() => {
      if (!ready.current) setState("error");
    }, 12000);
    const looping = window.setInterval(() => {
      const player = youtube.current;
      if (!ready.current || !player || end === null || player.getCurrentTime() < end) return;
      if (active()) player.seekTo(start, true);
      else player.pauseVideo();
    }, 200);
    void ensureYouTubeApi().then(({ Player }) => {
      if (disposed) return;
      youtube.current = new Player(element, {
        events: {
          onReady: ({ target }) => {
            if (disposed) return;
            youtube.current = target;
            ready.current = true;
            window.clearTimeout(timeout);
            updateVolume();
            if (active()) target.playVideo();
          },
          onStateChange: ({ target, data }) => {
            if (disposed) return;
            if (data === 0 && active()) {
              target.seekTo(start, true);
              target.playVideo();
            } else if (data === 1) setState("playing");
            else if (data === 2 || data === 0) setState((previous) => previous === "blocked" ? previous : "paused");
            else if (data === 3) setState("loading");
          },
          onAutoplayBlocked: () => { if (!disposed) setState("blocked"); },
          onError: () => {
            if (!disposed) {
              window.clearTimeout(timeout);
              setState("error");
            }
          },
        },
      });
    }).catch(() => { if (!disposed) setState("error"); });
    return () => {
      disposed = true;
      ready.current = false;
      window.clearTimeout(timeout);
      window.clearInterval(looping);
      // The iframe is owned by React; its removal is also what stops the audio.
      youtube.current?.stopVideo?.();
      youtube.current = null;
    };
  }, [type, videoId, start, end]);

  const playback = type === "youtube" && !videoId ? "error" : state;
  const youtubeUrl = videoId && `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${new URLSearchParams({
    enablejsapi: "1", origin: window.location.origin, playsinline: "1", rel: "0",
    controls: visible ? "1" : "0", start: String(start),
    ...(end === null ? {} : { end: String(end) }),
  })}`;
  const restartFile = (element: HTMLAudioElement) => {
    if (!active()) { element.pause(); return; }
    element.currentTime = start;
    if (element.paused) playFile(element);
  };
  const toggle = () => {
    if (playback === "playing") {
      audio.current?.pause();
      youtube.current?.pauseVideo();
    } else if (active()) {
      if (audio.current) playFile(audio.current);
      if (ready.current) youtube.current?.playVideo();
    }
  };

  return (
    <div className="room-playback" data-playback={playback}>
      <div className="room-playback__line">
        <span className="room-playback__signal" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        <strong role="status">{labels[playback]}{playback === "playing" && volume === 0 ? " · 음소거" : ""}</strong>
        {["playing", "paused", "blocked"].includes(playback) && (
          <button type="button" className="room-button room-button--quiet" onClick={toggle}>
            {playback === "playing" ? "일시정지" : playback === "blocked" ? "눌러서 재생" : "재생"}
          </button>
        )}
      </div>
      {type === "file" && (
        <audio ref={audio} src={resolveMediaUrl(source)} preload="auto" controls={visible} hidden={!visible}
          onLoadedMetadata={({ currentTarget }) => { currentTarget.currentTime = start; playFile(currentTarget); }}
          onPlaying={() => setState("playing")} onWaiting={() => setState("loading")}
          onPause={() => setState((previous) => previous === "blocked" || previous === "error" ? previous : "paused")}
          onError={() => setState("error")}
          onTimeUpdate={({ currentTarget }) => { if (end !== null && currentTarget.currentTime >= end) restartFile(currentTarget); }}
          onEnded={({ currentTarget }) => restartFile(currentTarget)} />
      )}
      {type === "youtube" && youtubeUrl && (
        <iframe ref={frame} src={youtubeUrl} title="라운드 음원" allow="autoplay; encrypted-media"
          className={visible ? "room-playback__video" : "room-playback__video--hidden"}
          tabIndex={visible ? undefined : -1} aria-hidden={!visible} />
      )}
    </div>
  );
}
