import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ReactPlayerComponent from "../../../components/ReactPlayerComponent";
import { AnswerItem } from "../../../types/answer";
import { HintItem } from "../../../types/hint";
import { SongItem } from "../../../types/song";
import { useAuth } from "../../../hooks/useAuth";
import { API_BASE_URL } from "../../../contants/env";

const API_BASE = `${API_BASE_URL}/api`;

type BulkSongEntry = {
    youtubeUrl: string;
    title: string;
    artist: string;
    answerType: ("title" | "artist" | "work")[];
    work: string;
    startTime: number;
    endTime: number;
    repeatCount: number;
    success: boolean;
};

const CreateMapStep2 = () => {
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const mapId = searchParams.get("mapId");
    const { accessToken } = useAuth();
    const navigate = useNavigate();

    // 모드 전환: 'single' | 'bulk'
    const [mode, setMode] = useState<"single" | "bulk">("bulk");

    // 벌크 모드 상태
    const [bulkUrls, setBulkUrls] = useState("");
    const [bulkEntries, setBulkEntries] = useState<BulkSongEntry[]>([]);
    const [bulkLoading, setBulkLoading] = useState(false);

    // 단일 모드 상태
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

    const normalizeUrl = (url: string) => {
        if (!url.startsWith("http")) {
            return "https://" + url;
        }
        return url;
    };

    // 벌크 메타데이터 조회
    const handleBulkFetch = async () => {
        const urls = bulkUrls
            .split("\n")
            .map((u) => u.trim())
            .filter((u) => u.length > 0);

        if (urls.length === 0) {
            alert("유튜브 URL을 입력해주세요.");
            return;
        }

        setBulkLoading(true);
        try {
            const res = await fetch(`${API_BASE}/songs/bulk-meta`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ urls }),
            });

            if (!res.ok) throw new Error("메타데이터 조회 실패");

            const data = await res.json();
            const entries: BulkSongEntry[] = data.map((item: any) => ({
                youtubeUrl: item.youtubeUrl,
                title: item.title || "",
                artist: item.artist || "",
                answerType: ["title"] as ("title" | "artist" | "work")[],
                work: "",
                startTime: 0,
                endTime: 30,
                repeatCount: 1,
                success: item.success,
            }));
            setBulkEntries(entries);
        } catch (err) {
            console.error(err);
            alert("메타데이터 조회 중 오류가 발생했습니다.");
        } finally {
            setBulkLoading(false);
        }
    };

    const handleBulkEntryChange = (index: number, field: keyof BulkSongEntry, value: any) => {
        setBulkEntries((prev) =>
            prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
        );
    };

    const toggleAnswerType = (index: number, type: "title" | "artist" | "work") => {
        setBulkEntries((prev) =>
            prev.map((entry, i) => {
                if (i !== index) return entry;
                const has = entry.answerType.includes(type);
                return {
                    ...entry,
                    answerType: has
                        ? entry.answerType.filter((t) => t !== type)
                        : [...entry.answerType, type],
                };
            })
        );
    };

    const removeBulkEntry = (index: number) => {
        setBulkEntries((prev) => prev.filter((_, i) => i !== index));
    };

    // 벌크 일괄 저장
    const handleBulkSave = async () => {
        if (!mapId || !accessToken) {
            alert("맵 ID 또는 로그인 정보가 없습니다.");
            return;
        }

        const validEntries = bulkEntries.filter(
            (e) => e.success && e.answerType.length > 0
        );

        if (validEntries.length === 0) {
            alert("저장할 노래가 없습니다. 정답 유형을 하나 이상 선택해주세요.");
            return;
        }

        let savedCount = 0;
        for (const entry of validEntries) {
            try {
                // 1. Song 생성
                const songRes = await fetch(`${API_BASE}/songs`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                        youtubeUrl: entry.youtubeUrl,
                        title: entry.title,
                    }),
                });
                if (!songRes.ok) throw new Error("노래 등록 실패");
                const song = await songRes.json();

                // 2. MapSong 연결
                const mapSongRes = await fetch(`${API_BASE}/maps/${mapId}/songs`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                        songId: song.id,
                        newSong: null,
                        startTime: entry.startTime,
                        endTime: entry.endTime,
                        repeatCount: entry.repeatCount,
                    }),
                });
                if (!mapSongRes.ok) throw new Error("맵-노래 연결 실패");
                const mapSong = await mapSongRes.json();

                // 3. 정답 생성
                const answerTexts: string[] = [];
                if (entry.answerType.includes("title")) answerTexts.push(entry.title);
                if (entry.answerType.includes("artist")) answerTexts.push(entry.artist);
                if (entry.answerType.includes("work") && entry.work.trim())
                    answerTexts.push(entry.work.trim());

                await fetch(`${API_BASE}/maps/songs/${mapSong.id}/answers`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({ answerTexts }),
                });

                // 4. songs 상태 업데이트
                const newSongItem: SongItem = {
                    id: mapSong.id,
                    songId: song.id,
                    title: entry.title,
                    youtubeUrl: entry.youtubeUrl,
                    startTime: entry.startTime,
                    endTime: entry.endTime,
                    repeatCount: entry.repeatCount,
                    answers: answerTexts.map((t, idx) => ({ id: Date.now() + idx, text: t })),
                    hints: [],
                };
                setSongs((prev) => [...prev, newSongItem]);
                savedCount++;
            } catch (err) {
                console.error(`저장 실패: ${entry.title}`, err);
            }
        }

        alert(`${savedCount}/${validEntries.length}곡 저장 완료!`);
        setBulkEntries([]);
        setBulkUrls("");
    };

    // 단일 모드 기존 함수들
    const fetchVideoInfo = async () => {
        try {
            const normalizedUrl = normalizeUrl(youtubeUrl);
            const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(normalizedUrl)}`);
            const data = await res.json();
            if (!data.title) {
                alert("영상 제목을 불러오지 못했습니다.");
                return;
            }
            setVideoInfo({ title: data.title, artist: data.author_name });
        } catch (err) {
            alert("영상 정보를 불러올 수 없습니다.");
        }
    };

    const handleAddAnswer = () => {
        if (!answerText.trim()) return;
        const newAnswer = { id: Date.now(), text: answerText.trim() };
        setAnswers((prev) => [...prev, newAnswer]);
        setAnswerText("");
    };

    const handleUpdateAnswer = (id: number, newText: string) => {
        setAnswers((prev) => prev.map((a) => (a.id === id ? { ...a, text: newText } : a)));
    };

    const handleDeleteAnswer = (id: number) => {
        setAnswers((prev) => prev.filter((a) => a.id !== id));
    };

    const handleAddHint = () => {
        if (!hintText.trim()) return;
        const newHint = { id: Date.now(), text: hintText.trim(), revealTime };
        setHints((prev) => [...prev, newHint]);
        setHintText("");
        setRevealTime(10);
    };

    const handleUpdateHint = (id: number, newText: string, newReveal: number) => {
        setHints((prev) => prev.map((h) => (h.id === id ? { ...h, text: newText, revealTime: newReveal } : h)));
    };

    const handleDeleteHint = (id: number) => {
        setHints((prev) => prev.filter((h) => h.id !== id));
    };

    const handleSelectSong = (songId: number) => {
        const selected = songs.find((s) => s.id === songId);
        if (!selected) return;
        setSelectedSongId(songId);
        setYoutubeUrl(selected.youtubeUrl);
        setStartTime(selected.startTime);
        setEndTime(selected.endTime);
        setRepeatCount(selected.repeatCount);
        setAnswers(selected.answers);
        setHints(selected.hints);
    };

    useEffect(() => {
        window.onbeforeunload = () => true;
        return () => {
            window.onbeforeunload = null;
        };
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
        if (!accessToken) {
            return alert("로그인이 필요합니다.");
        }

        try {
            const songPayload = { youtubeUrl, title: videoInfo.title };
            const isEditing = !!selectedSongId;
            const targetSong = songs.find((s) => s.id === selectedSongId);

            if (isEditing && !targetSong) throw new Error("선택된 노래 정보를 찾을 수 없습니다.");

            const songRes = await fetch(
                `${API_BASE}/songs${isEditing ? `/${targetSong!.songId}` : ""}`,
                {
                    method: isEditing ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify(songPayload),
                }
            );
            if (!songRes.ok) throw new Error(isEditing ? "노래 수정 실패" : "노래 등록 실패");
            const song = await songRes.json();

            const mapSongUrl = isEditing
                ? `${API_BASE}/maps/${mapId}/songs/${selectedSongId}`
                : `${API_BASE}/maps/${mapId}/songs`;

            const mapSongBody = {
                songId: isEditing && targetSong ? targetSong.songId : song.id,
                newSong: null,
                startTime,
                endTime,
                repeatCount,
            };

            const mapSongRes = await fetch(mapSongUrl, {
                method: isEditing ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}`,
                },
                body: JSON.stringify(mapSongBody),
            });
            if (!mapSongRes.ok) throw new Error("맵-노래 연결 " + (isEditing ? "수정" : "등록") + " 실패");
            const mapSong = await mapSongRes.json();

            const answerMethod = isEditing ? "PUT" : "POST";
            const hintMethod = isEditing ? "PUT" : "POST";

            await Promise.all([
                fetch(`${API_BASE}/maps/songs/${mapSong.id}/answers`, {
                    method: answerMethod,
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({ answerTexts: answers.map((a) => a.text) }),
                }),
                fetch(`${API_BASE}/maps/songs/${mapSong.id}/hints`, {
                    method: hintMethod,
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                        hints: hints.map((h) => ({
                            hintText: h.text,
                            revealTime: h.revealTime,
                        })),
                    }),
                }),
            ]);

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
            alert(isEditing ? "노래 수정 완료!" : "노래 저장 완료!");
        } catch (err) {
            const error = err as Error;
            console.error(error);
            alert(`저장 중 오류 발생: ${error.message}`);
        }
    };

    return (
        <div style={{ display: "flex", gap: "24px", padding: "24px" }}>
            {/* 왼쪽: 노래 추가 영역 */}
            <div style={{ flex: 2 }}>
                <div style={{ padding: "16px" }}>
                    {/* 모드 전환 버튼 */}
                    <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                        <button
                            onClick={() => setMode("bulk")}
                            style={{
                                padding: "8px 16px",
                                borderRadius: "6px",
                                backgroundColor: mode === "bulk" ? "#2563eb" : "#e5e7eb",
                                color: mode === "bulk" ? "#fff" : "#333",
                                fontWeight: "bold",
                                border: "none",
                                cursor: "pointer",
                            }}
                        >
                            벌크 추가
                        </button>
                        <button
                            onClick={() => setMode("single")}
                            style={{
                                padding: "8px 16px",
                                borderRadius: "6px",
                                backgroundColor: mode === "single" ? "#2563eb" : "#e5e7eb",
                                color: mode === "single" ? "#fff" : "#333",
                                fontWeight: "bold",
                                border: "none",
                                cursor: "pointer",
                            }}
                        >
                            개별 추가
                        </button>
                    </div>

                    {mode === "bulk" ? (
                        /* 벌크 모드 */
                        <div>
                            <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "16px" }}>
                                유튜브 링크 벌크 추가
                            </h2>
                            <textarea
                                value={bulkUrls}
                                onChange={(e) => setBulkUrls(e.target.value)}
                                placeholder={"유튜브 URL을 한 줄에 하나씩 입력하세요\nhttps://youtube.com/watch?v=...\nhttps://youtube.com/watch?v=..."}
                                style={{
                                    width: "100%",
                                    minHeight: "120px",
                                    padding: "12px",
                                    marginBottom: "12px",
                                    border: "1px solid #ccc",
                                    borderRadius: "6px",
                                    fontFamily: "monospace",
                                    fontSize: "13px",
                                    resize: "vertical",
                                }}
                            />
                            <button
                                onClick={handleBulkFetch}
                                disabled={bulkLoading}
                                style={{
                                    backgroundColor: bulkLoading ? "#9ca3af" : "#f59e0b",
                                    color: "#fff",
                                    padding: "10px 20px",
                                    borderRadius: "6px",
                                    fontWeight: "bold",
                                    border: "none",
                                    cursor: bulkLoading ? "not-allowed" : "pointer",
                                    marginBottom: "20px",
                                }}
                            >
                                {bulkLoading ? "조회 중..." : "메타데이터 자동 조회"}
                            </button>

                            {/* 벌크 결과 테이블 */}
                            {bulkEntries.length > 0 && (
                                <div>
                                    <h3 style={{ fontWeight: "bold", marginBottom: "12px" }}>
                                        조회 결과 ({bulkEntries.length}곡)
                                    </h3>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                        {bulkEntries.map((entry, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    border: entry.success ? "1px solid #d1d5db" : "1px solid #fca5a5",
                                                    borderRadius: "8px",
                                                    padding: "12px",
                                                    backgroundColor: entry.success ? "#fff" : "#fef2f2",
                                                }}
                                            >
                                                {!entry.success ? (
                                                    <div style={{ color: "#dc2626" }}>
                                                        조회 실패: {entry.youtubeUrl}
                                                        <button
                                                            onClick={() => removeBulkEntry(idx)}
                                                            style={{ marginLeft: "8px", color: "red", cursor: "pointer" }}
                                                        >
                                                            삭제
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                                            <span style={{ fontSize: "12px", color: "#6b7280", wordBreak: "break-all" }}>
                                                                {entry.youtubeUrl}
                                                            </span>
                                                            <button
                                                                onClick={() => removeBulkEntry(idx)}
                                                                style={{ color: "red", cursor: "pointer", fontSize: "12px", border: "none", background: "none" }}
                                                            >
                                                                삭제
                                                            </button>
                                                        </div>
                                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                                                            <div>
                                                                <label style={{ fontSize: "12px", color: "#6b7280" }}>제목</label>
                                                                <input
                                                                    value={entry.title}
                                                                    onChange={(e) => handleBulkEntryChange(idx, "title", e.target.value)}
                                                                    style={{
                                                                        width: "100%",
                                                                        padding: "6px",
                                                                        border: "1px solid #d1d5db",
                                                                        borderRadius: "4px",
                                                                    }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: "12px", color: "#6b7280" }}>가수</label>
                                                                <input
                                                                    value={entry.artist}
                                                                    onChange={(e) => handleBulkEntryChange(idx, "artist", e.target.value)}
                                                                    style={{
                                                                        width: "100%",
                                                                        padding: "6px",
                                                                        border: "1px solid #d1d5db",
                                                                        borderRadius: "4px",
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div style={{ marginBottom: "8px" }}>
                                                            <label style={{ fontSize: "12px", color: "#6b7280" }}>작품 (애니, 드라마 등)</label>
                                                            <input
                                                                value={entry.work}
                                                                onChange={(e) => handleBulkEntryChange(idx, "work", e.target.value)}
                                                                placeholder="작품명 입력 (선택)"
                                                                style={{
                                                                    width: "100%",
                                                                    padding: "6px",
                                                                    border: "1px solid #d1d5db",
                                                                    borderRadius: "4px",
                                                                }}
                                                            />
                                                        </div>
                                                        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                                                            <div>
                                                                <label style={{ fontSize: "12px", color: "#6b7280" }}>시작(초)</label>
                                                                <input
                                                                    type="number"
                                                                    value={entry.startTime}
                                                                    onChange={(e) => handleBulkEntryChange(idx, "startTime", Number(e.target.value))}
                                                                    style={{ width: "70px", padding: "4px", border: "1px solid #d1d5db", borderRadius: "4px" }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: "12px", color: "#6b7280" }}>끝(초)</label>
                                                                <input
                                                                    type="number"
                                                                    value={entry.endTime}
                                                                    onChange={(e) => handleBulkEntryChange(idx, "endTime", Number(e.target.value))}
                                                                    style={{ width: "70px", padding: "4px", border: "1px solid #d1d5db", borderRadius: "4px" }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: "12px", color: "#6b7280" }}>반복</label>
                                                                <input
                                                                    type="number"
                                                                    value={entry.repeatCount}
                                                                    onChange={(e) => handleBulkEntryChange(idx, "repeatCount", Number(e.target.value))}
                                                                    style={{ width: "70px", padding: "4px", border: "1px solid #d1d5db", borderRadius: "4px" }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                                                            <span style={{ fontSize: "13px", fontWeight: "bold" }}>정답:</span>
                                                            <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={entry.answerType.includes("title")}
                                                                    onChange={() => toggleAnswerType(idx, "title")}
                                                                />
                                                                <span style={{ fontSize: "13px" }}>제목 ({entry.title})</span>
                                                            </label>
                                                            <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={entry.answerType.includes("artist")}
                                                                    onChange={() => toggleAnswerType(idx, "artist")}
                                                                />
                                                                <span style={{ fontSize: "13px" }}>가수 ({entry.artist})</span>
                                                            </label>
                                                            <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={entry.answerType.includes("work")}
                                                                    onChange={() => toggleAnswerType(idx, "work")}
                                                                />
                                                                <span style={{ fontSize: "13px" }}>작품{entry.work ? ` (${entry.work})` : ""}</span>
                                                            </label>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleBulkSave}
                                        style={{
                                            marginTop: "16px",
                                            backgroundColor: "#2563eb",
                                            color: "#fff",
                                            padding: "12px 24px",
                                            borderRadius: "6px",
                                            fontWeight: "bold",
                                            border: "none",
                                            cursor: "pointer",
                                            width: "100%",
                                        }}
                                    >
                                        전체 저장 ({bulkEntries.filter((e) => e.success && e.answerType.length > 0).length}곡)
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* 단일 모드 (기존) */
                        <div>
                            <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "16px" }}>노래 추가</h2>
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
                                    borderRadius: "4px",
                                }}
                            />
                            <button
                                onClick={fetchVideoInfo}
                                style={{
                                    marginBottom: "16px",
                                    backgroundColor: "#ccc",
                                    padding: "6px 12px",
                                    borderRadius: "4px",
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

                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(3, 1fr)",
                                    gap: "8px",
                                    marginBottom: "16px",
                                }}
                            >
                                <input
                                    type="number"
                                    value={startTime}
                                    onChange={(e) => setStartTime(Number(e.target.value))}
                                    placeholder="시작(초)"
                                />
                                <input
                                    type="number"
                                    value={endTime}
                                    onChange={(e) => setEndTime(Number(e.target.value))}
                                    placeholder="끝(초)"
                                />
                                <input
                                    type="number"
                                    value={repeatCount}
                                    onChange={(e) => setRepeatCount(Number(e.target.value))}
                                    placeholder="반복 횟수"
                                />
                            </div>

                            <div style={{ marginBottom: "16px" }}>
                                <h3 style={{ fontWeight: "bold", marginBottom: "8px" }}>정답 추가</h3>
                                <input
                                    type="text"
                                    value={answerText}
                                    onChange={(e) => setAnswerText(e.target.value)}
                                    placeholder="정답 입력"
                                    style={{
                                        width: "100%",
                                        padding: "8px",
                                        marginBottom: "8px",
                                        borderRadius: "4px",
                                        border: "1px solid #ccc",
                                    }}
                                />
                                <button
                                    onClick={handleAddAnswer}
                                    style={{
                                        backgroundColor: "#22c55e",
                                        color: "#fff",
                                        padding: "6px 12px",
                                        borderRadius: "4px",
                                        marginBottom: "8px",
                                    }}
                                >
                                    정답 추가
                                </button>
                                <ul>
                                    {answers.map((a) => (
                                        <li key={a.id} style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
                                            <input
                                                value={a.text}
                                                onChange={(e) => handleUpdateAnswer(a.id, e.target.value)}
                                                style={{ flex: 1 }}
                                            />
                                            <button onClick={() => handleDeleteAnswer(a.id)} style={{ color: "red" }}>
                                                삭제
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div style={{ marginBottom: "16px" }}>
                                <h3 style={{ fontWeight: "bold", marginBottom: "8px" }}>힌트 추가</h3>
                                <input
                                    type="text"
                                    value={hintText}
                                    onChange={(e) => setHintText(e.target.value)}
                                    placeholder="힌트 입력"
                                    style={{
                                        width: "100%",
                                        padding: "8px",
                                        marginBottom: "8px",
                                        borderRadius: "4px",
                                        border: "1px solid #ccc",
                                    }}
                                />
                                <input
                                    type="number"
                                    value={revealTime}
                                    onChange={(e) => setRevealTime(Number(e.target.value))}
                                    placeholder="노출 시점(초)"
                                    style={{
                                        width: "100%",
                                        padding: "8px",
                                        marginBottom: "8px",
                                        borderRadius: "4px",
                                        border: "1px solid #ccc",
                                    }}
                                />
                                <button
                                    onClick={handleAddHint}
                                    style={{
                                        backgroundColor: "#6366f1",
                                        color: "#fff",
                                        padding: "6px 12px",
                                        borderRadius: "4px",
                                        marginBottom: "8px",
                                    }}
                                >
                                    힌트 추가
                                </button>
                                <ul>
                                    {hints.map((h) => (
                                        <li key={h.id} style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
                                            <input
                                                value={h.text}
                                                onChange={(e) => handleUpdateHint(h.id, e.target.value, h.revealTime)}
                                                style={{ flex: 1 }}
                                            />
                                            <input
                                                type="number"
                                                value={h.revealTime}
                                                onChange={(e) => handleUpdateHint(h.id, h.text, Number(e.target.value))}
                                                style={{ width: "80px" }}
                                            />
                                            <button onClick={() => handleDeleteHint(h.id)} style={{ color: "red" }}>
                                                삭제
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <button
                                onClick={handleSubmit}
                                style={{
                                    backgroundColor: "#2563eb",
                                    color: "white",
                                    padding: "10px 16px",
                                    borderRadius: "6px",
                                }}
                            >
                                저장
                            </button>
                        </div>
                    )}
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

            {/* 오른쪽: 추가된 노래 목록 */}
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
                <h3 style={{ fontWeight: "bold", marginBottom: "12px" }}>추가된 노래 목록 ({songs.length}곡)</h3>
                <ul>
                    {songs.map((song) => (
                        <li
                            key={song.id}
                            onClick={() => {
                                setMode("single");
                                handleSelectSong(song.id);
                            }}
                            style={{
                                cursor: "pointer",
                                fontWeight: song.id === selectedSongId ? "bold" : "normal",
                                marginBottom: "8px",
                            }}
                        >
                            {song.title}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default CreateMapStep2;
