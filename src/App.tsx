import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./app/layout/AppShell";
import { AppProviders } from "./app/providers/AppProviders";
import AccountPage from "./features/account/AccountPage";
import LobbyPage from "./features/lobby/LobbyPage";
import MapsPage from "./features/maps/MapsPage";
import RoadmapPage from "./features/roadmap/RoadmapPage";
import RoomPage from "./features/room/RoomPage";

export default function App() {
    return (
        <AppProviders>
            <AppShell>
                <Routes>
                    <Route path="/" element={<LobbyPage />} />
                    <Route path="/room/:roomName" element={<RoomPage />} />
                    <Route path="/rooms/:roomName" element={<RoomPage />} />
                    <Route path="/maps" element={<MapsPage />} />
                    <Route path="/map-list" element={<MapsPage />} />
                    <Route path="/my-maps" element={<MapsPage />} />
                    <Route path="/create-map/*" element={<MapsPage />} />
                    <Route path="/edit-map/:mapId/*" element={<MapsPage />} />
                    <Route path="/roadmap" element={<RoadmapPage />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="/login" element={<AccountPage />} />
                    <Route path="/signup" element={<AccountPage />} />
                    <Route path="/logout" element={<AccountPage />} />
                    <Route path="/update-user" element={<AccountPage />} />
                    <Route path="/delete-user" element={<AccountPage />} />
                    <Route path="/create-room" element={<Navigate replace to="/" />} />
                    <Route
                        path="/update-room/:roomName"
                        element={<Navigate replace to="/" />}
                    />
                    <Route path="*" element={<Navigate replace to="/" />} />
                </Routes>
            </AppShell>
        </AppProviders>
    );
}
