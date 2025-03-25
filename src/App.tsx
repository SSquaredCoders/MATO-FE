import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Lobby from "./Lobby.jsx";
import ChatRoom from "./ChatRoom.jsx";
import CreateMap from "./createMap/CreateMap.jsx";
import MapList from "./MapList.jsx";
import MapDetail from "./MapDetail";
import EditMap from "./editmap/EditMap";
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

                {/* 🔁 중첩 라우팅을 위한 create-map */}
                <Route path="/create-map/*" element={<CreateMap />} />

                {/* ✨ 맵 수정 전용 라우트 */}
                <Route path="/edit-map/:mapId" element={<EditMap />} />

                <Route path="/map-list" element={<MapList />} />
                <Route path="/maps/:id" element={<MapDetail />} />
            </Routes>
        </div>
    );
}

export default App;
