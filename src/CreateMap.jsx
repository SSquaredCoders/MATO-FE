import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL = "http://localhost:8080/maps";

function CreateMap() {
    const [mapName, setMapName] = useState("");
    const [description, setDescription] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const navigate = useNavigate();

    const handleCreateMap = async () => {
        if (!mapName.trim()) {
            alert("맵 이름을 입력하세요.");
            return;
        }

        try {
            const response = await axios.post(API_URL, {
                name: mapName,
                description: description,
                isPublic: isPublic
            });

            alert("맵 생성 성공!");
            navigate(`/map/${response.data.id}`); // 생성된 맵 페이지로 이동
        } catch (error) {
            console.error("맵 생성 실패:", error);
            alert("맵 생성에 실패했습니다.");
        }
    };

    return (
        <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
            <h1>맵 만들기</h1>
            <input
                type="text"
                placeholder="맵 이름"
                value={mapName}
                onChange={(e) => setMapName(e.target.value)}
            />
            <textarea
                placeholder="맵 설명"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
            />
            <label>
                <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                />
                공개 맵 여부
            </label>
            <button onClick={handleCreateMap}>맵 생성</button>
        </div>
    );
}

export default CreateMap;
