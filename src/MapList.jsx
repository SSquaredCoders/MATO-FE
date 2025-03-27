import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPublicMaps } from "./api/mapApi";

const MapList = () => {
    const [maps, setMaps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPublicMaps = async () => {
            try {
                const result = await getPublicMaps();
                if (result.success) {
                    setMaps(result.data);
                } else {
                    throw new Error(result.error || "공개된 맵 데이터를 불러오는 데 실패했습니다.");
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchPublicMaps();
    }, []);

    if (loading) return <p>로딩 중...</p>;
    if (error) return <p>오류 발생: {error}</p>;

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">공개된 맵 목록</h2>
            
            <Link to="/create-map" className="inline-block mb-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                새 맵 만들기
            </Link>
            
            {maps.length === 0 ? (
                <p className="text-gray-500">등록된 공개 맵이 없습니다.</p>
            ) : (
                <ul className="space-y-3">
                    {maps.map((map) => (
                        <li key={map.id} className="p-4 border rounded shadow-sm hover:bg-gray-100">
                            <Link to={`/maps/${map.id}`} className="block">
                                <strong className="text-lg">{map.name}</strong>
                                <p className="text-gray-600">{map.description}</p>
                                <p className="text-sm text-gray-500">작성자: {map.userId}</p>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default MapList;
