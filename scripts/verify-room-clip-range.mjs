import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const FRONTEND_ORIGIN = process.env.MATO_FE_URL || "http://localhost:5173";
const API_ORIGIN = process.env.MATO_API_URL || "http://127.0.0.1:8080";
const WS_ORIGIN = process.env.MATO_WS_URL || "ws://localhost:8080/ws/game";
const OUTPUT_DIR = path.resolve("output/web-game");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "room-clip-range-check.json");
const SCREENSHOT_OUTPUT = path.join(OUTPUT_DIR, "room-clip-range-check.png");

const READY_MATCH = "\uc900\ube44";
const START_MATCH = "\uac8c\uc784 \uc2dc\uc791";

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function createMap() {
  const stamp = Date.now();
  const response = await fetch(`${API_ORIGIN}/api/v2/maps`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `Clip Range Check ${stamp}`,
      description: "verify room clip propagation",
      createdBy: "host-01",
      difficulty: "normal",
      visibility: "private",
      showMediaControls: true,
      answerMode: "single-lock",
      roundFlowMode: "advance-on-correct",
      roundTimeLimitSeconds: 15,
      hintRevealDelaySeconds: 0,
      songs: [
        {
          clue: "clip-range",
          title: "Never Gonna Give You Up",
          artist: "Rick Astley",
          answers: ["never gonna give you up"],
          audioSourceType: "youtube",
          audioSourceValue: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          audioSourceLabel: "Rick Roll Clip",
          clipStartSeconds: 11,
          clipEndSeconds: 22,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`map create failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function createRoomAsHost(hostPage, mapId) {
  const stamp = Date.now();
  const roomSlug = `clip-room-${stamp}`;

  await hostPage.goto(FRONTEND_ORIGIN, { waitUntil: "networkidle" });
  await hostPage.locator('input[placeholder="ranked-demo"]').fill(roomSlug);
  await hostPage.locator("select").nth(0).selectOption(String(mapId));
  await hostPage.locator("button").nth(0).click({ force: true });
  await hostPage.waitForURL(/\/room\//, { timeout: 10000 });
  await hostPage.waitForTimeout(2000);

  return hostPage.url().split("/room/")[1];
}

async function joinAndReadyGuest(guestPage, roomName) {
  await guestPage.goto(FRONTEND_ORIGIN, { waitUntil: "networkidle" });

  return guestPage.evaluate(
    async ({ roomName, wsOrigin }) => {
      function frame(command, headers = {}, body = "") {
        const headerLines = Object.entries(headers).map(
          ([key, value]) => `${key}:${value}`,
        );
        return `${command}\n${headerLines.join("\n")}\n\n${body}\0`;
      }

      return await new Promise((resolve, reject) => {
        const socket = new WebSocket(wsOrigin, ["v12.stomp"]);
        const state = {
          connected: false,
          messages: [],
        };
        const timer = setTimeout(
          () => reject(new Error("guest websocket timeout")),
          15000,
        );

        socket.addEventListener("open", () => {
          socket.send(
            frame("CONNECT", {
              "accept-version": "1.2",
              "heart-beat": "0,0",
            }),
          );
        });

        socket.addEventListener("message", (event) => {
          const raw = String(event.data);
          state.messages.push(raw);

          if (raw.startsWith("CONNECTED")) {
            state.connected = true;
            socket.send(
              frame("SUBSCRIBE", {
                id: "sub-0",
                destination: `/topic/v2/rooms/${roomName}`,
              }),
            );

            const joinBody = JSON.stringify({
              type: "room.join",
              roomName,
              payload: { nickname: "guest-02" },
              clientTimestamp: new Date().toISOString(),
            });
            socket.send(
              frame(
                "SEND",
                {
                  destination: "/app/v2/game.send",
                  "content-type": "application/json",
                  "content-length": String(joinBody.length),
                },
                joinBody,
              ),
            );

            const readyBody = JSON.stringify({
              type: "room.ready.set",
              roomName,
              payload: { nickname: "guest-02", ready: true },
              clientTimestamp: new Date().toISOString(),
            });
            socket.send(
              frame(
                "SEND",
                {
                  destination: "/app/v2/game.send",
                  "content-type": "application/json",
                  "content-length": String(readyBody.length),
                },
                readyBody,
              ),
            );
            return;
          }

          if (raw.includes("guest-02")) {
            clearTimeout(timer);
            resolve({
              ok: true,
              messages: state.messages.slice(-4),
            });
          }
        });

        socket.addEventListener("error", () => {
          clearTimeout(timer);
          reject(new Error("guest websocket error"));
        });

        socket.addEventListener("close", () => {
          if (!state.connected) {
            clearTimeout(timer);
            reject(new Error("guest socket closed before connect"));
          }
        });
      });
    },
    {
      roomName,
      wsOrigin: WS_ORIGIN,
    },
  );
}

async function clickButtonByMatch(page, match) {
  const index = await page.locator("button").evaluateAll((nodes, text) => {
    return nodes.findIndex((node) => (node.textContent || "").includes(text));
  }, match);

  if (index < 0) {
    throw new Error(`button not found: ${match}`);
  }

  await page.locator("button").nth(index).click({ force: true });
  await page.waitForTimeout(800);
}

async function fetchSnapshot(roomName) {
  const response = await fetch(`${API_ORIGIN}/api/v2/rooms/${roomName}`);
  if (!response.ok) {
    throw new Error(
      `room snapshot failed: ${response.status} ${await response.text()}`,
    );
  }
  return response.json();
}

async function main() {
  ensureOutputDir();

  const map = await createMap();
  const browser = await chromium.launch({ headless: true });
  const hostPage = await browser.newPage({ viewport: { width: 1600, height: 1400 } });
  const guestPage = await browser.newPage();

  try {
    const roomName = await createRoomAsHost(hostPage, map.id);
    const guestResult = await joinAndReadyGuest(guestPage, roomName);

    await clickButtonByMatch(hostPage, READY_MATCH);
    await clickButtonByMatch(hostPage, START_MATCH);
    await hostPage.waitForTimeout(3000);

    const iframeSrc = await hostPage
      .locator(".room-stage__video-frame")
      .first()
      .getAttribute("src");
    const snapshot = await fetchSnapshot(roomName);

    const summary = {
      mapId: map.id,
      roomName,
      guestResult,
      iframeSrc,
      snapshot: {
        phase: snapshot.phase,
        round: snapshot.round,
        currentClipStartSeconds: snapshot.currentClipStartSeconds,
        currentClipEndSeconds: snapshot.currentClipEndSeconds,
        currentAudioSourceType: snapshot.currentAudioSourceType,
        currentAudioSourceValue: snapshot.currentAudioSourceValue,
        participants: snapshot.participants?.map((participant) => ({
          nickname: participant.nickname,
          ready: participant.ready,
          connected: participant.connected,
        })),
      },
    };

    const failures = [];
    if (!iframeSrc?.includes("start=11")) {
      failures.push(`iframe src missing start=11: ${iframeSrc ?? "null"}`);
    }
    if (!iframeSrc?.includes("end=22")) {
      failures.push(`iframe src missing end=22: ${iframeSrc ?? "null"}`);
    }
    if (snapshot.phase !== "PLAYING") {
      failures.push(`expected PLAYING phase, got ${snapshot.phase}`);
    }
    if (snapshot.currentClipStartSeconds !== 11) {
      failures.push(
        `expected currentClipStartSeconds 11, got ${snapshot.currentClipStartSeconds}`,
      );
    }
    if (snapshot.currentClipEndSeconds !== 22) {
      failures.push(
        `expected currentClipEndSeconds 22, got ${snapshot.currentClipEndSeconds}`,
      );
    }

    summary.failures = failures;

    fs.writeFileSync(JSON_OUTPUT, JSON.stringify(summary, null, 2));
    await hostPage.screenshot({ path: SCREENSHOT_OUTPUT, fullPage: true });

    if (failures.length > 0) {
      throw new Error(failures.join("\n"));
    }

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await browser.close();
  }
}

await main();
