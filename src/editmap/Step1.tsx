import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapFormData } from "../types/mapSetp1";

interface Props {
    mapId: string;
}

const Step1 = ({ mapId }: Props) => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState<MapFormData>({
        userId: 1,  // 👈 임시 유저 ID
        name: "",
        description: "",
        isPublic: true,
    });

    useEffect(() => {
        const fetchMapData = async () => {
            try {
                const res = await fetch(`http://localhost:8080/api/maps/${mapId}`);
                if (!res.ok) throw new Error("맵 데이터 불러오기 실패");

                const data = await res.json();
                setFormData({
                    userId: data.userId || 1,
                    name: data.name,
                    description: data.description,
                    isPublic: data.isPublic,
                });
            } catch (err) {
                alert("맵 데이터를 불러오는 중 오류가 발생했습니다.");
                console.error(err);
            }
        };

        fetchMapData();
    }, [mapId]);

    const handleNext = async () => {
        if (!formData.name.trim()) return alert("맵 이름을 입력하세요.");

        console.log('전송되는 데이터:', formData); // 👈 확인용 로그 추가

        try {
            const res = await fetch(`http://localhost:8080/api/maps/${mapId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const errorData = await res.json();  // 👈 에러 내용 보기
                console.error('서버 응답 오류:', errorData);
                throw new Error("맵 정보 수정 실패");
            }

            alert("맵 정보가 수정되었습니다.");
            navigate(`/edit-map/${mapId}/step2`);
        } catch (err) {
            alert("맵 정보 수정 중 오류가 발생했습니다.");
            console.error(err);
        }
    };


    return (
        <div className="p-4 max-w-md mx-auto">
            <h2 className="text-xl font-bold mb-4">맵 정보 수정</h2>

            <input
                type="text"
                placeholder="맵 이름"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2 mb-3 border rounded"
            />

            <textarea
                placeholder="맵 설명"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-2 mb-3 border rounded h-24"
            />

            <label className="flex items-center mb-4">
                <input
                    type="checkbox"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
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
