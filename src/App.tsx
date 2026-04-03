import React, { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./app/layout/AppShell";
import { AppProviders } from "./app/providers/AppProviders";
import LobbyPage from "./features/lobby/LobbyPage";

const RoomPage = lazy(() => import("./features/room/RoomPage"));
const MapsPage = lazy(() => import("./features/maps/MapsPage"));
const RoadmapPage = lazy(() => import("./features/roadmap/RoadmapPage"));
const AccountPage = lazy(() => import("./features/account/AccountPage"));
const GoogleAuthCallbackPage = lazy(
    () => import("./features/account/GoogleAuthCallbackPage"),
);

function RouteFallback() {
    return (
        <section className="panel page-loading">
            <p className="eyebrow">Loading</p>
            <h2>화면을 불러오는 중입니다.</h2>
            <p className="footnote">조금만 기다리면 바로 이어서 볼 수 있습니다.</p>
        </section>
    );
}

export default function App() {
    return (
        <AppProviders>
            <AppShell>
                <Suspense fallback={<RouteFallback />}>
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
                        <Route
                            path="/auth/google/callback"
                            element={<GoogleAuthCallbackPage />}
                        />
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
                </Suspense>
            </AppShell>
        </AppProviders>
    );
}
