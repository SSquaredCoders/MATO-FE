import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Lobby from "./Lobby.jsx";
import ChatRoom from "./ChatRoom.jsx";
import Upload from "./Upload.jsx";

function App() {
    return (
        <div>
            <nav>
                <Link to="/">홈</Link> |
                <Link to="/upload">노래 업로드</Link>
            </nav>

            <Routes>
                <Route path="/" element={<Lobby />} />
                <Route path="/room/:roomName" element={<ChatRoom />} />
                <Route path="/upload" element={<Upload />} />
            </Routes>
        </div>
    );
}

export default App;
