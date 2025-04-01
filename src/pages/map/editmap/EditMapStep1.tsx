import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapFormData } from "../../../types/mapSetp1";
import { updateMap, getMap } from "../../../api/mapApi";
import { useAuth } from "../../../hooks/useAuth";

interface Props {
    mapId: string;
}

const EditMapStep1 = ({ mapId }: Props) => {
    const navigate = useNavigate();
    const { user, accessToken } = useAuth();
    const [formData, setFormData] = useState<MapFormData>({
        userId: user?.userId || "",
        name: "",
        description: "",
        isPublic: true,
        songs: [],
    });

    useEffect(() => {
        const fetchMapData = async () => {
            if (!accessToken) {
                alert("로그인이 필요합니다.");
                navigate("/login");
                return;
            }

            try {
                const result = await getMap(mapId);
                
                if (!result.success) {
                    throw new Error(result.error || "맵 데이터 불러오기 실패");
                }

                const data = result.data;
                setFormData({
                    userId: data.userId || user?.userId || "",
                    name: data.name,
                    description: data.description,
                    isPublic: data.isPublic,
                    songs: data.songs || [],
                });
            } catch (err) {
                alert("맵 데이터를 불러오는 중 오류가 발생했습니다.");
                console.error(err);
            }
        };

        fetchMapData();
    }, [mapId, accessToken, user?.userId, navigate]);

    const handleNext = async () => {
        if (!formData.name.trim()) return alert("맵 이름을 입력하세요.");
        if (!accessToken) return alert("로그인이 필요합니다.");

        try {
            // 현재 노래 정보는 유지한 채 기본 정보만 업데이트
            const updatedFormData = {
                ...formData,
                userId: user?.userId || formData.userId,
            };
            
            console.log("맵 수정 데이터:", updatedFormData); // 디버깅용
            
            const result = await updateMap(mapId, updatedFormData, accessToken);

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
