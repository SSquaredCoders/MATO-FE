import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Lobby from "./Lobby.jsx";
import Login from "./Login.jsx";
import Logout from "./Logout.jsx";
import Register from "./Register.jsx";
import UpdateUser from "./UpdateUser.jsx";
import DeleteUser from "./DeleteUser.jsx";
import RoomCreatePage from "./RoomCreatePage.jsx";
import RoomUpdatePage from "./RoomUpdatePage.jsx";
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
                <Route path="/login" element={<Login />} />
                <Route path="/logout" element={<Logout />} />
                <Route path="/register" element={<Register />} />
                <Route path="/update-user" element={<UpdateUser />} />
                <Route path="/delete-user" element={<DeleteUser />} />
                <Route path="/create-room" element={<RoomCreatePage />} />
                <Route path="/update-room/:roomName" element={<RoomUpdatePage />} />
                <Route path="/room/:roomName" element={<ChatRoom />} />

                {/* 🔁 중첩 라우팅을 위한 create-map */}
                <Route path="/create-map/*" element={<CreateMap />} />

                {/* ✨ 맵 수정 전용 라우트 */}
                <Route path="/edit-map/:mapId/*" element={<EditMap />} />

                <Route path="/map-list" element={<MapList />} />
                <Route path="/maps/:id" element={<MapDetail />} />
            </Routes>
        </div>
    );
}

export default App;
