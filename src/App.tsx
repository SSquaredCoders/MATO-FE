import React from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
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
import MyMaps from "./MyMaps";

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
