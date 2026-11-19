import assert from "node:assert/strict";
import path from "node:path";
import { chromium } from "playwright";

const origin = process.env.MATO_FE_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  headless: true,
  channel: process.env.MATO_BROWSER_CHANNEL || "chrome",
});
const map = {
  id: 1,
  name: "아주 긴 한국어 게임 맵 이름을 끝까지 확인할 수 있는 노래 모음",
  songCount: 42,
  difficulty: "normal",
  visibility: "private",
};
const room = {
  name: "친구들과 함께 노래를 맞히는 아주 긴 한국어 방 제목입니다",
  hostNickname: "테스트",
  participantCount: 2,
  maxParticipants: 8,
  phase: "PLAYING",
  map,
};
const rooms = Array.from({ length: 6 }, (_, index) => ({
  ...room,
  name: index === 0 ? room.name : `${index + 1}번째 한국어 음악 퀴즈 방`,
}));

async function waitUntil(predicate, message, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(predicate(), message);
}

async function checkViewport(viewport) {
  const page = await browser.newPage({ viewport });
  let mode = "hold";
  let release;
  let roomRequests = 0;
  const screenshot = async (state) => {
    if (process.env.MATO_TEST_SCREENSHOTS) {
      await page.screenshot({ path: path.join(process.env.MATO_TEST_SCREENSHOTS, `lobby-redesign-${viewport.width}-${state}.png`), fullPage: true });
    }
  };
  await page.addInitScript(() => {
    localStorage.setItem("mato-auth-session", JSON.stringify({
      state: { user: { id: 1, userId: "test", nickname: "테스트", role: "USER" }, accessToken: null },
      version: 0,
    }));
  });
  await page.route("**/api/v2/maps**", (route) => route.fulfill({ json: [map] }));
  await page.route("**/api/v2/lobby/rooms", async (route) => {
    roomRequests += 1;
    if (mode === "hold") await new Promise((resolve) => { release = resolve; });
    if (mode === "error") await route.fulfill({ status: 500, body: "error" });
    else await route.fulfill({ json: mode === "empty" ? [] : mode === "waiting" ? [{ ...room, phase: "LOBBY" }] : rooms });
  });

  try {
    await page.goto(origin);
    await page.getByText("방 목록을 불러오는 중이에요").waitFor();
    await screenshot("loading");
    assert.equal(await page.getByText("아직 열린 방이 없어요").count(), 0);
    await waitUntil(() => Boolean(release), "initial room request did not start");
    mode = "error";
    release();
    await page.getByText("방 목록을 확인할 수 없어요").waitFor({ timeout: 20000 });
    await screenshot("error");
    assert.equal(await page.getByText("아직 열린 방이 없어요").count(), 0);
    mode = "hold";
    release = undefined;
    await page.getByRole("button", { name: "다시 시도" }).click();
    await page.getByText("방 목록을 불러오는 중이에요").waitFor();
    assert.equal(await page.getByText("방 목록을 확인할 수 없어요").count(), 0);
    await waitUntil(() => Boolean(release), "retry did not start");
    mode = "empty";
    release();
    await page.getByText("아직 열린 방이 없어요").waitFor();
    await screenshot("empty");

    mode = "error";
    await page.getByRole("button", { name: "새로고침" }).click();
    await page.getByText("방 목록을 확인할 수 없어요").waitFor({ timeout: 20000 });
    assert.equal(await page.getByText("아직 열린 방이 없어요").count(), 0);
    mode = "empty";
    await page.getByRole("button", { name: "다시 시도" }).click();
    await page.getByText("아직 열린 방이 없어요").waitFor();

    mode = "rooms";
    await page.getByRole("button", { name: "새로고침" }).click();
    await page.getByText(room.name).waitFor();
    await page.getByRole("button", { name: /대기 중/ }).click();
    await page.getByText("대기 중인 방이 없어요").waitFor();
    await page.getByRole("button", { name: /전체 방/ }).click();
    assert.equal(await page.locator(".qp-room-row").count(), rooms.length);
    assert.equal(await page.locator(".qp-room-row strong").first().getAttribute("title"), room.name);
    assert.equal(await page.locator(".qp-map-item").getAttribute("title"), map.name);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, `horizontal page overflow at ${viewport.width}px`);
    const backgrounds = await page.evaluate(() => [
      getComputedStyle(document.documentElement).backgroundColor,
      getComputedStyle(document.body).backgroundColor,
    ]);
    assert.deepEqual(backgrounds, ["rgb(16, 17, 20)", "rgb(16, 17, 20)"]);

    const measurements = await page.evaluate(() => {
      const shell = document.querySelector(".qp-shell--lobby");
      const row = document.querySelector(".qp-room-row");
      const firstViewport = (element) => {
        const rect = element.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      };
      return {
        baseSize: getComputedStyle(document.querySelector(".qp-lobby")).fontSize,
        rowHeight: row.getBoundingClientRect().height,
        separator: getComputedStyle(row).borderBottomWidth,
        visible: [firstViewport(row), firstViewport(document.querySelector(".qp-button--primary"))],
        radii: [...shell.querySelectorAll("*")].filter((element) => {
          const style = getComputedStyle(element);
          return style.display !== "none" && element.getBoundingClientRect().width > 0;
        }).flatMap((element) => {
          const style = getComputedStyle(element);
          return [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius].map(parseFloat);
        }),
        accent: getComputedStyle(shell).getPropertyValue("--lobby-accent").trim(),
      };
    });
    assert.equal(measurements.baseSize, "14px");
    assert.ok(measurements.rowHeight >= 40 && measurements.rowHeight <= 44, `row height: ${measurements.rowHeight}`);
    assert.equal(measurements.separator, "1px");
    assert.deepEqual(measurements.visible, [true, true], "room and quick start must be visible initially");
    assert.ok(measurements.radii.every((radius) => radius <= 6), `radius exceeds 6px: ${Math.max(...measurements.radii)}`);
    assert.equal(measurements.accent, "#a8c7fa");

    const contrasts = await page.evaluate(() => {
      function rgb(value) {
        return value.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number);
      }
      function luminance(color) {
        const [r, g, b] = rgb(color).map((value) => {
          value /= 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      const pairs = [
        [".qp-map-item strong", ".qp-map-item"],
        [".qp-map-item small", ".qp-map-item"],
        [".qp-room-row strong", ".qp-room-row"],
        [".qp-room-row > span:nth-child(3)", ".qp-room-row"],
        [".qp-room-state", ".qp-room-state"],
        [".qp-room-feedback", ".qp-room-panel"],
        [".qp-room-tab--active", ".qp-room-tab--active"],
        [".qp-button--primary", ".qp-button--primary"],
        [".qp-button--soft", ".qp-button--soft"],
      ];
      const results = pairs.map(([text, background]) => {
        const foreground = luminance(getComputedStyle(document.querySelector(text)).color);
        let element = document.querySelector(background);
        while (element && getComputedStyle(element).backgroundColor === "rgba(0, 0, 0, 0)") element = element.parentElement;
        const behind = luminance(getComputedStyle(element).backgroundColor);
        return { text, ratio: (Math.max(foreground, behind) + 0.05) / (Math.min(foreground, behind) + 0.05) };
      });
      const badge = document.querySelector(".qp-room-state");
      const originalClass = badge.className;
      for (const phase of ["lobby", "playing", "countdown", "scoring", "finished"]) {
        badge.className = `qp-room-state qp-room-state--${phase}`;
        const style = getComputedStyle(badge);
        const foreground = luminance(style.color);
        const behind = luminance(getComputedStyle(document.body).backgroundColor);
        results.push({ text: `badge ${phase}`, ratio: (Math.max(foreground, behind) + 0.05) / (Math.min(foreground, behind) + 0.05) });
      }
      badge.className = originalClass;
      return results;
    });
    for (const { text, ratio } of contrasts) {
      assert.ok(ratio >= 4.5, `${text} contrast ${ratio.toFixed(2)} is below 4.5:1`);
    }
    await screenshot("rooms");

    await page.getByRole("button", { name: "방 만들기" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading", { name: "방 만들기" }).waitFor();
    assert.equal(await dialog.locator(".qp-modal__panel").evaluate((element) =>
      getComputedStyle(element).backgroundColor), "rgb(25, 27, 32)");
    assert.equal(await dialog.locator(".qp-modal__panel").evaluate((element) =>
      getComputedStyle(element).borderRadius), "6px");
    assert.equal(await dialog.locator("select").inputValue(), String(map.id));
    await dialog.getByRole("button", { name: "닫기" }).last().click();

    mode = "hold";
    release = undefined;
    await page.getByRole("button", { name: "새로고침" }).click();
    await page.getByText("방 목록을 새로고침하고 있어요. 이전 목록을 표시합니다.").waitFor();
    assert.equal(await page.locator(".qp-room-row").count(), rooms.length);
    await waitUntil(() => Boolean(release), "refresh did not start");
    mode = "error";
    release();
    await page.getByText("새로고침하지 못했어요. 이전 목록은 현재 방 상태와 다를 수 있어요.").waitFor({ timeout: 20000 });
    assert.equal(await page.locator(".qp-room-row").count(), rooms.length);
    mode = "rooms";
    await page.getByRole("button", { name: "다시 시도" }).click();
    await page.getByText("방 목록은 15초마다 자동으로 새로고침됩니다.").waitFor();
    if (viewport.width === 1440) {
      const beforePoll = roomRequests;
      await waitUntil(() => roomRequests > beforePoll, "15-second room polling did not occur", 20000);
    }
    mode = "waiting";
    await page.getByRole("button", { name: "새로고침" }).click();
    await page.getByRole("button", { name: "전체 방 1" }).waitFor();
    await page.getByRole("button", { name: "빠른 입장" }).click();
    await page.waitForURL(/\/room\//);
    await page.goto(origin);
    await page.getByRole("link", { name: "게임 방법" }).click();
    await page.locator(".timeline").waitFor();
    const otherRoute = await page.evaluate(() => ({
      lobby: Boolean(document.querySelector(".qp-shell--lobby")),
      header: getComputedStyle(document.querySelector(".qp-topbar")).backgroundImage,
      body: getComputedStyle(document.body).backgroundColor,
    }));
    assert.equal(otherRoute.lobby, false);
    assert.match(otherRoute.header, /linear-gradient/);
    assert.notEqual(otherRoute.body, "rgb(16, 17, 20)");
    console.log(`${viewport.width}px: ${measurements.baseSize} base, ${measurements.rowHeight}px row, ${measurements.separator} separator, max radius ${Math.max(...measurements.radii)}px; states, contrast and route isolation passed`);
  } finally {
    await page.close();
  }
}

async function checkGuest() {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.route("**/api/v2/lobby/rooms", (route) => route.fulfill({ json: [] }));
  try {
    await page.goto(origin);
    await page.getByText("아직 열린 방이 없어요").waitFor();
    const nickname = page.getByLabel("닉네임");
    await nickname.fill("게스트");
    await page.getByRole("button", { name: "빠른 입장" }).click();
    const dialog = page.getByRole("dialog");
    assert.equal(await dialog.getByLabel("닉네임").inputValue(), "게스트");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await dialog.getByRole("button", { name: "닫기" }).last().click();
    console.log("Guest nickname and create fallback passed");
  } finally {
    await page.close();
  }
}

try {
  await checkViewport({ width: 1440, height: 900 });
  await checkViewport({ width: 375, height: 812 });
  await checkGuest();
} finally {
  await browser.close();
}
