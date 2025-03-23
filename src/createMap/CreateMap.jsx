// src/pages/CreateMap/CreateMap.tsx
import { Routes, Route } from "react-router-dom";
import Step1 from "./Step1";
import Step2 from "./Step2";

const CreateMap = () => {
    return (
        <div>
            <h2>맵 만들기</h2>
            <Routes>
                <Route path="/" element={<Step1 />} />
                <Route path="step2" element={<Step2 />} />
            </Routes>
        </div>
    );
};

export default CreateMap;
