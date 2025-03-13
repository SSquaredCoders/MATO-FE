import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Lobby from "./Lobby.jsx";
import Login from "./Login.jsx";
import Register from "./Register.jsx";
import ChatRoom from "./ChatRoom.jsx";
import CreateMap from "./CreateMap.jsx";

function App() {
    return (
        <div>
            <nav>
                <Link to="/">홈</Link> |
                <Link to="/create-map">맵 만들기</Link>
            </nav>

            <Routes>
                <Route path="/" element={<Lobby />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/room/:roomName" element={<ChatRoom />} />
                <Route path="/create-map" element={<CreateMap />} />
            </Routes>
        </div>
    );
}

export default App;
