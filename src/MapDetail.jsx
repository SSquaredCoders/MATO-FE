import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMap, deleteMap } from "./api/mapApi";
import { useAuth } from "./hooks/useAuth";

const MapDetail = () => {
    const { id } = useParams();
    const [map, setMap] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const { user, accessToken } = useAuth();

    useEffect(() => {
        const fetchMapDetail = async () => {
            try {
                const result = await getMap(id);
                if (result.success) {
                    setMap(result.data);
                } else {
                    throw new Error(result.error || "맵 데이터를 불러오는 데 실패했습니다.");
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchMapDetail();
    }, [id]);

    const handleDelete = async () => {
        if (!window.confirm("정말로 이 맵을 삭제하시겠습니까?")) {
            return;
        }

        try {
            setLoading(true);
            const result = await deleteMap(id, accessToken);
            if (result.success) {
                alert("맵이 삭제되었습니다.");
                navigate("/maps");
            } else {
                throw new Error(result.error || "맵 삭제 중 오류가 발생했습니다.");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <p className="p-6 text-center">로딩 중...</p>;
    if (error) return <p className="p-6 text-center text-red-500">오류 발생: {error}</p>;
    if (!map) return <p className="p-6 text-center">맵 정보를 찾을 수 없습니다.</p>;

    const isOwner = user && user.userId === map.userId;

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-2">{map.name}</h2>
            <p className="text-sm text-gray-500 mb-1">작성자: {map.userId}</p>
            <p className="text-sm text-gray-500 mb-4">공개 여부: {map.isPublic ? "공개" : "비공개"}</p>
            <p className="mb-6">{map.description}</p>

            {/* 맵에 포함된 노래 목록 */}
            {map.songs && map.songs.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-xl font-bold mb-2">수록곡 ({map.songs.length})</h3>
                    <ul className="space-y-2">
                        {map.songs.map((songInfo) => (
                            <li key={songInfo.id} className="p-3 border rounded">
                                <p className="font-medium">{songInfo.song.title}</p>
                                <p className="text-sm text-gray-500">
                                    재생 구간: {songInfo.startTime}초 ~ {songInfo.endTime}초 (총 {songInfo.repeatCount}회 반복)
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 작성자인 경우에만 수정/삭제 버튼 표시 */}
            {isOwner && (
                <div className="flex space-x-3">
                    <button
                        className="bg-yellow-400 text-black px-4 py-2 rounded hover:bg-yellow-500"
                        onClick={() => navigate(`/edit-map/${id}/step1`)}
                    >
                        수정하기
                    </button>
                    <button
                        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                        onClick={handleDelete}
                    >
                        삭제하기
                    </button>
                </div>
            )}
        </div>
    );
};

export default MapDetail;
