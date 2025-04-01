import React from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import Lobby from "./Lobby.jsx";
import Login from "./pages/auth/Login.jsx";
import Logout from "./pages/auth/Logout.jsx";
import Register from "./pages/auth/Register.jsx";
import UpdateUser from "./pages/auth/UpdateUser.jsx";
import DeleteUser from "./pages/auth/DeleteUser.jsx";
import RoomCreatePage from "./pages/room/RoomCreatePage.jsx";
import RoomUpdatePage from "./pages/room/RoomUpdatePage.jsx";
import ChatRoom from "./pages/room/ChatRoom.jsx";
import CreateMap from "./pages/map/createMap/CreateMap.jsx";
import MapList from "./pages/map/MapList.jsx";
import MapDetail from "./pages/map/MapDetail";
import EditMap from "./pages/map/editmap/EditMap";
import MyMaps from "./pages/map/MyMaps";

function App() {
    return (
        <AuthProvider>
            <div>
                <Navbar />

                <Routes>
                    <Route path="/" element={<Lobby />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Register />} />
                    <Route path="/logout" element={<Logout />} />
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
                    <Route path="/maps" element={<MapList />} />
                    <Route path="/maps/:id" element={<MapDetail />} />
                    <Route path="/my-maps" element={<MyMaps />} />
                </Routes>
            </div>
        </AuthProvider>
    );
}

export default App;
