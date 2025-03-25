// src/pages/CreateMapStep2.tsx

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ReactPlayerComponent from "../components/ReactPlayerComponent";
import { AnswerItem } from "../types/answer";
import { HintItem } from "../types/hint";
import { SongItem } from "../types/song";

const API_BASE = "http://localhost:8080/api";

const CreateMapStep2 = () => {
    const [searchParams] = useSearchParams();
    const mapId = searchParams.get("mapId");

    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [videoInfo, setVideoInfo] = useState<{ title: string; artist: string } | null>(null);

    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(30);
    const [repeatCount, setRepeatCount] = useState(1);

    const [answerText, setAnswerText] = useState("");
    const [hintText, setHintText] = useState("");
    const [revealTime, setRevealTime] = useState(10);

    const [answers, setAnswers] = useState<AnswerItem[]>([]);
    const [hints, setHints] = useState<HintItem[]>([]);
    const [songs, setSongs] = useState<SongItem[]>([]);
    const [selectedSongId, setSelectedSongId] = useState<number | null>(null);

    const navigate = useNavigate();

    const fetchVideoInfo = async () => {
        try {
            const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(youtubeUrl)}`);
            const data = await res.json();
            setVideoInfo({ title: data.title, artist: data.author_name });
        } catch (err) {
            alert("영상 정보를 불러올 수 없습니다.");
        }
    };

    const handleAddAnswer = () => {
        if (!answerText.trim()) return;
        const newAnswer = {id: Date.now(), text: answerText.trim()};
        setAnswers((prev) => [...prev, newAnswer]);
        setAnswerText("");
    };

    const handleUpdateAnswer = (id: number, newText: string) => {
        setAnswers((prev) => prev.map((a) => (a.id === id ? {...a, text: newText} : a)));
    };

    const handleDeleteAnswer = (id: number) => {
        setAnswers((prev) => prev.filter((a) => a.id !== id));
    };

    const handleAddHint = () => {
        if (!hintText.trim()) return;
        const newHint = {id: Date.now(), text: hintText.trim(), revealTime};
        setHints((prev) => [...prev, newHint]);
        setHintText("");
        setRevealTime(10);
    };

    const handleUpdateHint = (id: number, newText: string, newReveal: number) => {
        setHints((prev) => prev.map((h) => (h.id === id ? {...h, text: newText, revealTime: newReveal} : h)));
    };

    const handleDeleteHint = (id: number) => {
        setHints((prev) => prev.filter((h) => h.id !== id));
    };

    const handleSelectSong = (songId: number) => {
        const selected = songs.find(s => s.id === songId);
        if (!selected) return;

        setSelectedSongId(songId); // 선택 상태 저장
        setYoutubeUrl(selected.youtubeUrl);
        setStartTime(selected.startTime);
        setEndTime(selected.endTime);
        setRepeatCount(selected.repeatCount);
        setAnswers(selected.answers);
        setHints(selected.hints);
    };

    useEffect(() => {
        window.onbeforeunload = () => true;
        return () => { window.onbeforeunload = null; };
    }, []);

    const resetForm = () => {
        setYoutubeUrl("");
        setVideoInfo(null);
        setStartTime(0);
        setEndTime(30);
        setRepeatCount(1);
        setAnswers([]);
        setHints([]);
        setAnswerText("");
        setHintText("");
        setRevealTime(10);
        setSelectedSongId(null);
    };

    useEffect(() => {
        const savedSongs = localStorage.getItem(`songs_${mapId}`);
        if (savedSongs) {
            setSongs(JSON.parse(savedSongs));
        }
    }, [mapId]);

    useEffect(() => {
        if (songs.length > 0) {
            localStorage.setItem(`songs_${mapId}`, JSON.stringify(songs));
        }
    }, [songs, mapId]);

    const handleFinalMapSave = () => {
        localStorage.removeItem(`songs_${mapId}`);
        alert("맵 저장 완료!");
    };

    const handleSubmit = async () => {
        if (!mapId || !youtubeUrl || !videoInfo || answers.length === 0) {
            return alert("모든 필드를 정확히 입력해주세요.");
        }

        try {
            const songRes = await fetch(`${API_BASE}/songs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ youtubeUrl, title: videoInfo.title, artist: videoInfo.artist }),
            });
            if (!songRes.ok) throw new Error("노래 등록 실패");
            const song = await songRes.json();

            const mapSongRes = await fetch(`${API_BASE}/maps/${mapId}/songs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ songId: song.id, startTime, endTime, repeatCount }),
            });
            if (!mapSongRes.ok) throw new Error("맵-노래 연결 실패");
            const mapSong = await mapSongRes.json();

            const answersRes = await fetch(`${API_BASE}/maps/songs/${mapSong.id}/answers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answerTexts: answers.map((a) => a.text) }),
            });
            if (!answersRes.ok) throw new Error("정답 저장 실패");

            const hintsRes = await fetch(`${API_BASE}/maps/songs/${mapSong.id}/hints`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hints: hints.map((h) => ({ hintText: h.text, revealTime: h.revealTime })) }),
            });
            if (!hintsRes.ok) throw new Error("힌트 저장 실패");

            setSongs((prev) => [
                ...prev,
                { id: mapSong.id,songId: song.id, title: videoInfo.title, youtubeUrl, startTime, endTime, repeatCount, answers, hints },
            ]);

            resetForm();
            alert("노래 저장 완료!");
        } catch (err) {
            const error = err as Error;
            console.error(error);
            alert(`저장 중 오류 발생: ${error.message}`);
        }
    };

    return (
        <div style={{display: "flex", gap: "24px", padding: "24px"}}>
            {/* ▶ 왼쪽: 노래 추가/입력 영역 */}
            <div style={{flex: 2}}>
                <div style={{padding: "16px"}}>
                    <h2 style={{fontSize: "20px", fontWeight: "bold", marginBottom: "16px"}}>노래 추가</h2>

                    {/* 유튜브 URL 입력 + 영상 정보 불러오기 */}
                    <input
                        type="text"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="YouTube URL"
                        style={{
                            width: "100%",
                            padding: "8px",
                            marginBottom: "8px",
                            border: "1px solid #ccc",
                            borderRadius: "4px"
                        }}
                    />
                    <button
                        onClick={fetchVideoInfo}
                        style={{
                            marginBottom: "16px",
                            backgroundColor: "#ccc",
                            padding: "6px 12px",
                            borderRadius: "4px"
                        }}
                    >
                        영상 정보 불러오기
                    </button>

                    {videoInfo && (
                        <ReactPlayerComponent
                            url={youtubeUrl}
                            startTime={startTime}
                            endTime={endTime}
                            repeatCount={repeatCount}
                        />
                    )}

                    {/* 설정 영역 */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "8px",
                        marginBottom: "16px"
                    }}>
                        <input type="number" value={startTime} onChange={(e) => setStartTime(Number(e.target.value))}
                               placeholder="시작(초)"/>
                        <input type="number" value={endTime} onChange={(e) => setEndTime(Number(e.target.value))}
                               placeholder="끝(초)"/>
                        <input type="number" value={repeatCount}
                               onChange={(e) => setRepeatCount(Number(e.target.value))} placeholder="반복 횟수"/>
                    </div>

                    {/* 정답 입력 */}
                    <div style={{marginBottom: "16px"}}>
                        <h3 style={{fontWeight: "bold", marginBottom: "8px"}}>정답 추가</h3>
                        <input type="text" value={answerText} onChange={(e) => setAnswerText(e.target.value)}
                               placeholder="정답 입력" style={{
                            width: "100%",
                            padding: "8px",
                            marginBottom: "8px",
                            borderRadius: "4px",
                            border: "1px solid #ccc"
                        }}/>
                        <button onClick={handleAddAnswer} style={{
                            backgroundColor: "#22c55e",
                            color: "#fff",
                            padding: "6px 12px",
                            borderRadius: "4px",
                            marginBottom: "8px"
                        }}>정답 추가
                        </button>
                        <ul>
                            {answers.map((a) => (
                                <li key={a.id} style={{display: "flex", gap: "8px", marginBottom: "4px"}}>
                                    <input value={a.text} onChange={(e) => handleUpdateAnswer(a.id, e.target.value)}
                                           style={{flex: 1}}/>
                                    <button onClick={() => handleDeleteAnswer(a.id)} style={{color: "red"}}>삭제</button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* 힌트 입력 */}
                    <div style={{marginBottom: "16px"}}>
                        <h3 style={{fontWeight: "bold", marginBottom: "8px"}}>힌트 추가</h3>
                        <input type="text" value={hintText} onChange={(e) => setHintText(e.target.value)}
                               placeholder="힌트 입력" style={{
                            width: "100%",
                            padding: "8px",
                            marginBottom: "8px",
                            borderRadius: "4px",
                            border: "1px solid #ccc"
                        }}/>
                        <input type="number" value={revealTime} onChange={(e) => setRevealTime(Number(e.target.value))}
                               placeholder="노출 시점(초)" style={{
                            width: "100%",
                            padding: "8px",
                            marginBottom: "8px",
                            borderRadius: "4px",
                            border: "1px solid #ccc"
                        }}/>
                        <button onClick={handleAddHint} style={{
                            backgroundColor: "#6366f1",
                            color: "#fff",
                            padding: "6px 12px",
                            borderRadius: "4px",
                            marginBottom: "8px"
                        }}>힌트 추가
                        </button>
                        <ul>
                            {hints.map((h) => (
                                <li key={h.id} style={{display: "flex", gap: "8px", marginBottom: "4px"}}>
                                    <input value={h.text}
                                           onChange={(e) => handleUpdateHint(h.id, e.target.value, h.revealTime)}
                                           style={{flex: 1}}/>
                                    <input type="number" value={h.revealTime}
                                           onChange={(e) => handleUpdateHint(h.id, h.text, Number(e.target.value))}
                                           style={{width: "80px"}}/>
                                    <button onClick={() => handleDeleteHint(h.id)} style={{color: "red"}}>삭제</button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <button onClick={handleSubmit} style={{
                        backgroundColor: "#2563eb",
                        color: "white",
                        padding: "10px 16px",
                        borderRadius: "6px"
                    }}>
                        저장
                    </button>
                </div>
                <button
                    onClick={async () => {
                        await handleFinalMapSave();
                        navigate("/");
                    }}
                    style={{
                        backgroundColor: "#10b981",
                        color: "white",
                        padding: "10px 16px",
                        borderRadius: "6px",
                        marginTop: "16px",
                    }}
                >
                    맵 저장 완료 후 홈으로 이동
                </button>
            </div>

            {/* ▶ 오른쪽: 추가된 노래 목록 */}
            <div
                style={{
                    flex: 1,
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    padding: "16px",
                    maxHeight: "80vh",
                    overflowY: "auto",
                }}
            >
                <h3 style={{fontWeight: "bold", marginBottom: "12px"}}>추가된 노래 목록</h3>
                <ul>
                    {songs.map((song) => (
                        <li
                            key={song.id}
                            onClick={() => handleSelectSong(song.id)}
                            style={{
                                cursor: "pointer",
                                fontWeight: song.id === selectedSongId ? "bold" : "normal",
                                marginBottom: "8px",
                            }}
                        >
                            🎵 {song.title}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default CreateMapStep2;