import { useState } from "react";
import {useNavigate} from "react-router-dom";


const Step1 = () => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const navigate = useNavigate();

    const handleNext = async () => {
        if (!name.trim()) return alert("맵 이름을 입력하세요");

        try {
            const response = await fetch("http://localhost:8080/api/maps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: 1, // 👉 실제 유저 ID로 교체 (임시값)
                    name,
                    description,
                    isPublic,
                }),
            });

            if (!response.ok) throw new Error("맵 생성 실패");

            const map = await response.json();
            const mapId = map.id;

            // ✅ Step2로 이동 + mapId 전달
            navigate(`/create-map/step2?mapId=${mapId}`);
        } catch (err) {
            alert("맵 생성 중 오류 발생");
            console.error(err);
        }
    };

    return (
        <div className="p-4 max-w-md mx-auto">
            <h2 className="text-xl font-bold mb-4">맵 정보 입력</h2>

            <input
                type="text"
                placeholder="맵 이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 mb-3 border rounded"
            />

            <textarea
                placeholder="맵 설명"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 mb-3 border rounded h-24"
            />

            <label className="flex items-center mb-4">
                <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="mr-2"
                />
                공개 여부 (체크 시 공개)
            </label>

            <button
                onClick={handleNext}
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
            >
                다음
            </button>
        </div>
    );
};

export default Step1;
