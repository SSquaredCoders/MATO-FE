import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapFormData } from "../types/mapSetp1";
import { updateMap, getMap } from "../api/mapApi";
import { useAuth } from "../hooks/useAuth";

interface Props {
    mapId: string;
}

const EditMapStep1 = ({ mapId }: Props) => {
    const navigate = useNavigate();
    const { user, accessToken } = useAuth();
    const [formData, setFormData] = useState<MapFormData>({
        userId: user?.id?.toString() || "",
        name: "",
        description: "",
        isPublic: true,
    });

    useEffect(() => {
        const fetchMapData = async () => {
            if (!accessToken) {
                alert("로그인이 필요합니다.");
                navigate("/login");
                return;
            }

            try {
                const result = await getMap(mapId, accessToken);
                
                if (!result.success) {
                    throw new Error(result.error || "맵 데이터 불러오기 실패");
                }

                const data = result.data;
                setFormData({
                    userId: data.userId || user?.id?.toString() || "",
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
    }, [mapId, accessToken, user?.id, navigate]);

    const handleNext = async () => {
        if (!formData.name.trim()) return alert("맵 이름을 입력하세요.");
        if (!accessToken) return alert("로그인이 필요합니다.");

        try {
            const result = await updateMap({
                id: mapId,
                ...formData
            }, accessToken);

            if (!result.success) {
                throw new Error(result.error || "맵 정보 수정 실패");
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

export default EditMapStep1;
