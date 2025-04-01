import { Routes, Route } from "react-router-dom";
import CreateMapStep1 from "./CreateMapStep1.tsx";
import CreateMapStep2 from "./CreateMapStep2.tsx";

const CreateMap = () => {
    return (
        <div>
            <h2>맵 만들기</h2>
            <Routes>
                <Route path="/" element={<CreateMapStep1 />} />
                <Route path="step2" element={<CreateMapStep2 />} />
            </Routes>
        </div>
    );
};

export default CreateMap;
