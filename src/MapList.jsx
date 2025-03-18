import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE_URL = "http://localhost:8080/api";

const MapList = () => {
    const [maps, setMaps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPublicMaps = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/maps/public`);
                if (!response.ok) {
                    throw new Error("공개된 맵 데이터를 불러오는 데 실패했습니다.");
                }
                const data = await response.json();
                setMaps(data);
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
        <div>
            <h2>공개된 맵 목록</h2>
            {maps.length === 0 ? (
                <p>등록된 공개 맵이 없습니다.</p>
            ) : (
                <ul>
                    {maps.map((map) => (
                        <li key={map.id}>
                            <Link to={`/maps/${map.id}`}>
                                <strong>{map.name}</strong> - {map.description}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default MapList;
