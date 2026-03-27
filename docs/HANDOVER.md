# MATO v2 Handover

## 1. What this project is

MATO is a web remake of the StarCraft custom-map style song quiz game.

The active work is the `v2` path:

- Frontend repo: `MATO-FE`
- Backend repo: `MATO`

Ignore the old mixed implementation unless you need to salvage old data. The current playable flow is built around the new v2 room and map features.

## 2. Repositories

### Frontend

- Repo: `MATO-FE`
- Stack: React + Vite + TypeScript
- Main areas:
  - `src/features/lobby`
  - `src/features/room`
  - `src/features/maps`
  - `src/shared/api`
  - `src/shared/realtime`

### Backend

- Repo: `MATO`
- Stack: Spring Boot 3.x
- Main v2 areas:
  - `src/main/java/com/lshzzz/mato/controller/v2`
  - `src/main/java/com/lshzzz/mato/service/v2`
  - `src/main/java/com/lshzzz/mato/model/v2`

## 3. What currently works

- Lobby room list
- Room creation and room entry
- Ready toggle
- Host-only game start
- Answer submission through the same input used for room chat/guessing
- Round advance and scoring
- Two answer modes:
  - `single-lock`: first correct answer locks the round
  - `multi-score`: multiple players can score on the same round
- Two round flow modes:
  - `advance-on-correct`
  - `timer-or-skip`
- Map creation and map editing
- Owner-only map visibility
- Song source per question:
  - YouTube URL
  - Uploaded audio file
- Clip start/end configuration per song
- Builder preview:
  - Uploaded files use a custom preview transport
  - YouTube links use an embedded preview player plus the same clip timeline

## 4. Local run

### Backend

```powershell
cd C:\Users\GS002\Documents\codex\MATO
.\gradlew.bat bootRun
```

Backend defaults:

- URL: `http://localhost:8080`
- WebSocket: `ws://localhost:8080/ws/game`
- Local DB: H2 file DB at `build/h2/mato`

### Frontend

```powershell
cd C:\Users\GS002\Documents\codex\MATO-FE
npm install
npm run dev
```

Frontend defaults:

- URL: `http://localhost:5173` in dev
- API base fallback: `http://localhost:8080`

## 5. Most important files

### Frontend

- `src/features/maps/MapsPage.tsx`
  - map create/edit UI
  - song rows
  - clip timeline editor
  - YouTube/file preview handling
- `src/features/room/RoomPage.tsx`
  - room UI
  - answer input
  - current media display
- `src/shared/types/contracts.ts`
  - frontend contract types

### Backend

- `src/main/java/com/lshzzz/mato/service/v2/V2MapCatalogService.java`
  - map storage/loading
  - map create/update behavior
- `src/main/java/com/lshzzz/mato/service/v2/V2MapAssetStorageService.java`
  - uploaded audio file storage
- `src/main/java/com/lshzzz/mato/service/v2/V2RoomRuntimeService.java`
  - room state
  - round progression
  - answer handling
  - media selection for current round
- `src/main/java/com/lshzzz/mato/controller/v2`
  - v2 REST/WebSocket entry points

## 6. Current storage model

- Map metadata is persisted locally through H2
- Uploaded media files are stored on disk under the backend build folder
- Room runtime is still process-local runtime state

This means:

- Maps survive backend restart locally
- Uploaded files survive locally
- Active room state does not survive restart

## 7. Known limitations

- Legacy code still exists beside v2 code. v2 is the path to continue.
- YouTube embed playback depends on YouTube policy. Some videos will refuse embed playback.
- Builder preview for YouTube is intentionally simpler than file preview:
  - preview is visible
  - clip bar is editable
  - it does not have the same custom transport control as uploaded files
- Full production auth/permission model is not done
- Room runtime is not yet Redis-backed
- UI still needs polish, especially around room comfort and final game feel

## 8. Recommended next work order

1. Separate room chat rules from answer visibility rules
2. Improve in-game media playback polish
3. Finish map editing UX
4. Decide the final room/game rule model
5. Move runtime state toward Redis if the project is resumed seriously
6. Clean out unused legacy paths after v2 is stable

## 9. Important rule for future work

When touching game flow, always treat the backend as the authority for:

- current round
- who scored
- whether the round is locked
- when the next round starts

Do not move answer validation or score truth back into the client.

## 10. Branch note

- Active branch has been `develop`
- Work has been committed in small chunks
- Pushes have been done directly to `origin/develop`

If someone new takes over, start by running both repos locally and verify:

1. backend boots
2. frontend loads `/maps`
3. a map can be created
4. a room can be created from that map
5. game start and answer flow still work
