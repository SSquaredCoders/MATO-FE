import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMyMaps, deleteMap } from "./api/mapApi";
import { useAuth } from "./hooks/useAuth";

const MyMaps = () => {
    const [maps, setMaps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user, accessToken } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) {
            navigate("/login");
            return;
        }

        const fetchMyMaps = async () => {
            try {
                const result = await getMyMaps(accessToken, user.userId);
                if (result.success) {
                    setMaps(result.data);
                } else {
                    throw new Error(result.error || "내 맵 데이터를 불러오는 데 실패했습니다.");
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchMyMaps();
    }, [user, accessToken, navigate]);

    const handleDelete = async (mapId) => {
        if (!window.confirm("정말로 이 맵을 삭제하시겠습니까?")) {
            return;
        }

        try {
            const result = await deleteMap(mapId, accessToken);
            if (result.success) {
                alert("맵이 삭제되었습니다.");
                setMaps(maps.filter(map => map.id !== mapId));
            } else {
                throw new Error(result.error || "맵 삭제 중 오류가 발생했습니다.");
            }
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) return <p className="p-6 text-center">로딩 중...</p>;
    if (error) return <p className="p-6 text-center text-red-500">오류 발생: {error}</p>;

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">내 맵 목록</h2>
            
            <Link to="/create-map" className="inline-block mb-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                새 맵 만들기
            </Link>
            
            {maps.length === 0 ? (
                <p className="text-gray-500">등록된 맵이 없습니다.</p>
            ) : (
                <ul className="space-y-3">
                    {maps.map((map) => (
                        <li key={map.id} className="p-4 border rounded shadow-sm hover:bg-gray-100">
                            <Link to={`/maps/${map.id}`} className="block mb-2">
                                <strong className="text-lg">{map.name}</strong>
                                <p className="text-gray-600">{map.description}</p>
                                <p className="text-sm text-gray-500">공개 여부: {map.isPublic ? "공개" : "비공개"}</p>
                            </Link>
                            <div className="flex space-x-2">
                                <button 
                                    className="px-3 py-1 bg-yellow-400 text-black rounded hover:bg-yellow-500"
                                    onClick={() => navigate(`/edit-map/${map.id}/step1`)}
                                >
                                    수정
                                </button>
                                <button 
                                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                    onClick={() => handleDelete(map.id)}
                                >
                                    삭제
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default MyMaps; 