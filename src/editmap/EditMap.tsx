import { useParams, Routes, Route } from 'react-router-dom';
import Step1 from './Step1';
import Step2 from './Step2';

const EditMap = () => {
    const { mapId } = useParams();

    if (!mapId) {
        return <div>맵 ID가 없습니다. 올바른 URL로 접근해주세요.</div>;
    }

    return (
        <Routes>
            <Route path="step1" element={<Step1 mapId={mapId} />} />
            <Route path="step2" element={<Step2 mapId={mapId} />} />
        </Routes>
    );
};

export default EditMap;
