import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactPlayerComponent from "../../../components/ReactPlayerComponent";
import { AnswerItem } from "../../../types/answer";
import { HintItem } from "../../../types/hint";
import { SongItem } from "../../../types/song";
import { MapItem } from "../../../types/mapSetp2";
import { useAuth } from "../../../hooks/useAuth";
import { API_BASE_URL } from "../../../contants/env";

const API_BASE = `${API_BASE_URL}/api`;

interface Props {
    mapId: string;
}

const EditMapStep2 = ({ mapId }: Props) => {
    const { accessToken } = useAuth();
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

    const normalizeUrl = (url: string) => {
        if (!url.startsWith("http")) {
            return "https://" + url;
        }
        return url;
    };

    const fetchVideoInfo = async () => {
        try {
            const normalizedUrl = normalizeUrl(youtubeUrl);
            console.log("🧪 요청할 URL:", `https://noembed.com/embed?url=${encodeURIComponent(normalizedUrl)}`);

            const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(normalizedUrl)}`);
            const data = await res.json();

            console.log("📦 응답 데이터:", data);

            if (!data.title) {
                alert("⚠️ 영상 제목을 불러오지 못했습니다.");
                return;
            }

            setVideoInfo({ title: data.title, artist: data.author_name });
        } catch (err) {
            alert("영상 정보를 불러올 수 없습니다.");
            console.error("❌ fetchVideoInfo 에러:", err);
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

    const handleSubmit = async () => {
        if (!mapId || !youtubeUrl || !videoInfo || answers.length === 0) {
            return alert("모든 필드를 정확히 입력해주세요.");
        }

        if (!accessToken) {
            return alert("로그인이 필요합니다.");
        }

        try {
            const songPayload = {
                youtubeUrl,
                title: videoInfo.title,
            };

            // 수정인지 추가인지 분기
            const isEditing = !!selectedSongId;
            const targetSong = songs.find((s) => s.id === selectedSongId);

            if (isEditing && !targetSong) {
                throw new Error("선택된 노래 정보를 찾을 수 없습니다.");
            }

            // 1. 곡 저장/수정
            const songRes = await fetch(
                `${API_BASE}/songs${isEditing ? `/${targetSong!.songId}` : ""}`,
                {
                    method: isEditing ? "PUT" : "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${accessToken}`
                    },
                    body: JSON.stringify(songPayload),
                }
            );

            if (!songRes.ok) {
                throw new Error(isEditing ? "노래 수정 실패" : "노래 등록 실패");
            }

            const song = await songRes.json();

            // 2. MapSong 저장/수정
            const mapSongUrl = isEditing
                ? `${API_BASE}/maps/${mapId}/songs/${selectedSongId}`
                : `${API_BASE}/maps/${mapId}/songs`;

            // MapSongRequestDto 형식에 맞게 요청 본문 구성
            const mapSongBody = {
                songId: isEditing && targetSong ? targetSong.songId : song.id,
                newSong: null, // 기존 노래를 사용할 때는 null
                startTime,
                endTime,
                repeatCount
            };

            console.log("🧪 MapSong 요청:", mapSongBody);
            const mapSongRes = await fetch(mapSongUrl, {
                method: isEditing ? "PATCH" : "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}`
                },
                body: JSON.stringify(mapSongBody),
            });

            if (!mapSongRes.ok) {
                throw new Error("맵-노래 연결 " + (isEditing ? "수정" : "등록") + " 실패");
            }

            const mapSong = await mapSongRes.json();

            // 3. 정답/힌트 저장 or 수정
            const answerMethod = isEditing ? "PUT" : "POST";
            const hintMethod = isEditing ? "PUT" : "POST";

            await Promise.all([
                fetch(`${API_BASE}/maps/songs/${mapSong.id}/answers`, {
                    method: answerMethod,
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({ answerTexts: answers.map((a) => a.text) }),
                }),
                fetch(`${API_BASE}/maps/songs/${mapSong.id}/hints`, {
                    method: hintMethod,
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        hints: hints.map((h) => ({
                            text: h.text,
                            revealTime: h.revealTime,
                        })),
                    }),
                }),
            ]);

            // 4. 상태 업데이트
            const newSongItem: SongItem = {
                id: mapSong.id,
                songId: song.id,
                title: videoInfo.title,
                youtubeUrl,
                startTime,
                endTime,
                repeatCount,
                answers,
                hints,
            };

            setSongs((prev) =>
                isEditing
                    ? prev.map((s) => (s.id === selectedSongId ? newSongItem : s))
                    : [...prev, newSongItem]
            );

            resetForm();
            alert("노래 저장 완료!");
        } catch (err) {
            const error = err as Error;
            console.error(error);
            alert(`저장 중 오류 발생: ${error.message}`);
        }
    };

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
                            visible={true}
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

export default EditMapStep2;