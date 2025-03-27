import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapFormData } from "../types/mapSetp1";
import { createMap, checkMapExists } from "../api/mapApi";
import { useAuth } from "../hooks/useAuth";

const CreateMapStep1 = () => {
    const { user, accessToken } = useAuth();
    const [formData, setFormData] = useState<MapFormData>({
        userId: user?.userId || "",
        name: "",
        description: "",
        isPublic: true,
        songs: [], // 빈 배열로 초기화
    });
    const [isChecking, setIsChecking] = useState(false);
    const navigate = useNavigate();

    // user가 변경될 때 userId도 업데이트
    useEffect(() => {
        if (user?.userId) {
            setFormData(prev => ({ ...prev, userId: user.userId }));
        }
    }, [user]);

    const handleNext = async () => {
        if (!formData.name.trim()) return alert("맵 이름을 입력하세요.");
        if (!accessToken) return alert("로그인이 필요합니다.");
        if (!user) return alert("사용자 정보가 없습니다.");

        // userId 업데이트 (재확인)
        const updatedFormData = { 
            ...formData, 
            userId: user.userId, // id 대신 userId 사용
            songs: [] // 빈 배열 확인
        };

        console.log("서버로 보내는 데이터:", updatedFormData); // 디버깅용

        // 맵 이름 중복 체크
        setIsChecking(true);
        try {
            const checkResult = await checkMapExists(formData.name);
            if (checkResult.success && checkResult.data.isDuplicate) {
                alert("이미 존재하는 맵 이름입니다. 다른 이름을 입력해주세요.");
                setIsChecking(false);
                return;
            }

            // 맵 생성
            const result = await createMap(updatedFormData, accessToken);
            
            if (!result.success) {
                throw new Error(result.error || "맵 생성 실패");
            }

            navigate(`/create-map/step2?mapId=${result.data?.id}`);
        } catch (err) {
            alert("맵 생성 중 오류 발생");
            console.error(err);
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <div className="p-4 max-w-md mx-auto">
            <h2 className="text-xl font-bold mb-4">맵 정보 입력</h2>

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
                disabled={isChecking}
                className={`bg-blue-500 text-white py-2 px-4 rounded ${
                    isChecking ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
                }`}
            >
                {isChecking ? '처리 중...' : '다음'}
            </button>
        </div>
    );
};

export default CreateMapStep1;