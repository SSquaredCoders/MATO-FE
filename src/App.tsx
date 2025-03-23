import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Lobby from "./Lobby.jsx";
import ChatRoom from "./ChatRoom.jsx";
import CreateMap from "./createMap/CreateMap.jsx";
import MapList from "./MapList.jsx";
import MapDetail from "./MapDetail";
import CreateMapStep2 from "./createMap/Step2";


function App() {
    return (
        <div>
            <nav>
                <Link to="/">홈</Link> |
                <Link to="/create-map">맵 만들기</Link> |
                <Link to="/map-list">맵 리스트</Link>
            </nav>

            <Routes>
                <Route path="/" element={<Lobby />} />
                <Route path="/room/:roomName" element={<ChatRoom />} />
                <Route path="/create-map" element={<CreateMap />} />
                <Route path="/create-map/step2" element={<CreateMapStep2 />} />
                <Route path="/map-list" element={<MapList />} />
                <Route path="/maps/:id" element={<MapDetail />} />
            </Routes>
        </div>
    );
}

export default App;
