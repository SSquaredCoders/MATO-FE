import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import MapEditForm from "./MapEditForm";

const API_BASE_URL = "http://localhost:8080/api";

const MapDetail = () => {
    const { id } = useParams();
    const [map, setMap] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        const fetchMapDetail = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/maps/${id}`);
                if (!response.ok) {
                    throw new Error("맵 데이터를 불러오는 데 실패했습니다.");
                }
                const data = await response.json();
                setMap(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchMapDetail();
    }, [id]);

    const handleEditToggle = () => {
        setIsEditing(!isEditing);
    };

    if (loading) return <p>로딩 중...</p>;
    if (error) return <p>오류 발생: {error}</p>;
    if (!map) return <p>맵 정보를 찾을 수 없습니다.</p>;

    return (
        <div>
            <h2>{map.name}</h2>
            <p>{map.description}</p>
            <button onClick={handleEditToggle}>{isEditing ? "취소" : "편집"}</button>
            {isEditing && <MapEditForm map={map} onEditComplete={() => setIsEditing(false)} />}
        </div>
    );
};

export default MapDetail;
