import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { chromium } from "playwright";

const api = "http://localhost:8080";
const app = "http://localhost:5173";
const artifactDir = process.env.ROOM_SCREENSHOTS;
const fixture = process.env.ROOM_PLAYER_FIXTURE === "1";
const channel = process.env.PLAYWRIGHT_CHROMIUM_CHANNEL;
const browser = await chromium.launch(channel ? { channel } : {});
const roomName = `플레이검증-${randomUUID().slice(0, 8)}`;
const host = "xxx";
const roomUrl = `${app}/room/${encodeURIComponent(roomName)}`;

try {
  const map = await fetch(`${api}/api/v2/maps/5?includeSongs=true&viewer=${host}`).then((res) => res.json());
  const created = await fetch(`${api}/api/v2/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomName, hostNickname: host, mapId: map.id }),
  });
  assert.ok(created.ok, await created.text());

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const mobile = await browser.newPage({ viewport: { width: 375, height: 812 }, hasTouch: true });
  const pages = [desktop, mobile];
  if (process.env.ROOM_TRACE === "1") {
    desktop.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => {
      for (const match of String(payload).matchAll(/\n\n(\{[^\0]+\})\0/g)) {
        const event = JSON.parse(match[1]);
        const { snapshot, accepted, message } = event.payload;
        console.log(event.type, accepted, message, snapshot?.phase, snapshot?.round, snapshot?.currentReveal);
      }
    }));
  }
  if (fixture) {
    for (const page of pages) {
      await page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({
        contentType: "application/javascript",
        body: `window.roomFixture = { plays: 0, stops: 0, volumes: [] };
          window.YT = { Player: function(frame, {events}) {
            const fixture = window.roomFixture;
            fixture.error = () => events.onError({target:this,data:5});
            this.setVolume = n => fixture.volumes.push(n);
            this.playVideo = () => {
              fixture.plays++;
              events.onStateChange({target:this,data:3});
              setTimeout(() => fixture.plays === 1 ? events.onAutoplayBlocked() :
                events.onStateChange({target:this,data:1}), 100);
            };
            this.pauseVideo = () => events.onStateChange({target:this,data:2});
            this.stopVideo = () => fixture.stops++;
            this.getCurrentTime = () => 0;
            this.seekTo = () => {};
            setTimeout(() => events.onReady({target:this}), 0);
          }};
          window.onYouTubeIframeAPIReady();`,
      }));
      await page.route("https://www.youtube.com/embed/**", (route) => route.fulfill({ body: "" }));
    }
  }
  const snap = (label) => artifactDir && Promise.all(pages.map((page) => page.screenshot({
    path: join(artifactDir, `room-${fixture ? "fixture" : "real"}-${page.viewportSize().width}-${label}.png`),
  })));
  const heading = (page, name) => page.getByRole("heading", { name, exact: true });
  const button = (page, name) => page.getByRole("button", { name, exact: true });
  const status = (page, value) => page.locator(`.room-playback[data-playback="${value}"]`);
  const both = (fn) => Promise.all(pages.map(fn));
  const animation = (page) => page.locator(".room-playback__signal i").first().evaluate((el) => getComputedStyle(el).animationName);
  const submit = async (page, text) => {
    const input = page.locator("#room-answer");
    await input.fill(text);
    await input.press("Enter");
    await page.waitForFunction(() => document.querySelector("#room-answer").value === "");
  };
  await both((page) => page.goto(roomUrl));
  await desktop.getByLabel("입장할 닉네임").fill(host);
  await button(desktop, "입장").click();
  await mobile.getByLabel("입장할 닉네임").fill("모바일검증참가자");
  await button(mobile, "입장").click();
  await button(mobile, "준비 완료").click();
  await desktop.waitForFunction(() => [...document.querySelectorAll("button")]
    .some((button) => button.textContent === "게임 시작" && !button.disabled));
  await submit(mobile, "가나다라마바사아자차카타파하".repeat(12));
  await snap("waiting");
  await button(desktop, "게임 시작").click();
  await both((page) => page.getByText(/^힌트 공개까지/).waitFor());
  await snap("play-before-hint");

  for (const [page, widths] of [[desktop, [1440]], [mobile, [375, 500]]]) {
    for (const width of widths) {
      const height = page.viewportSize().height;
      await page.setViewportSize({ width, height });
      const metrics = await page.locator(".room-play").evaluate((root) => {
        const row = root.querySelector(".room-play__ranking li");
        const input = root.querySelector("#room-answer");
        const box = input.getBoundingClientRect();
        const bg = getComputedStyle(root).backgroundColor;
        const contrast = (fg, background) => {
          const light = (color) => color.match(/[\d.]+/g).slice(0, 3).map(Number)
            .map((n) => n / 255).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
            .reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
          const values = [light(fg), light(background)].sort((a, b) => b - a);
          return (values[0] + .05) / (values[1] + .05);
        };
        const colors = [".room-play__header > span", ".room-play__timer strong", ".room-playback strong", ".room-play__composer label"];
        return {
          font: getComputedStyle(root).fontSize, row: row.getBoundingClientRect().height,
          border: getComputedStyle(row).borderBottomWidth,
          radius: Math.max(...[...root.querySelectorAll("button,input,section")].map((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius))),
          documentOverflow: document.documentElement.scrollWidth > innerWidth, inputTop: box.top, inputBottom: box.bottom,
          contrast: Math.min(...colors.map((target) => contrast(getComputedStyle(root.querySelector(target)).color, bg))),
        };
      });
      assert.equal(metrics.font, "14px");
      assert.equal(metrics.row, 42);
      assert.equal(metrics.border, "1px");
      assert.ok(metrics.radius <= 6);
      assert.equal(metrics.documentOverflow, false);
      assert.ok(metrics.inputTop >= 0 && metrics.inputBottom <= height);
      assert.ok(metrics.contrast >= 4.5);
      console.log(width, metrics);
    }
    await page.setViewportSize({ width: widths[0], height: page.viewportSize().height });
  }
  if (fixture) {
    await both((page) => status(page, "blocked").waitFor());
    await snap("autoplay-blocked");
    assert.equal(await animation(desktop), "none");
    await both((page) => button(page, "눌러서 재생").click());
    await both((page) => status(page, "playing").waitFor());
    assert.notEqual(await animation(desktop), "none");
    await mobile.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await animation(mobile), "none");
    await desktop.getByRole("slider", { name: "볼륨" }).press("Home");
    await desktop.waitForFunction(() => window.roomFixture.volumes.at(-1) === 0);
    await button(desktop, "일시정지").click();
    await status(desktop, "paused").waitFor();
    assert.equal(await animation(desktop), "none");
    await button(desktop, "재생").click();
    await status(desktop, "playing").waitFor();
  } else {
    await both((page) => page.locator('.room-playback:not([data-playback="loading"])').waitFor({ timeout: 18000 }));
    console.log("Actual provider states:", await both((page) => page.locator(".room-playback").getAttribute("data-playback")));
  }
  await both((page) => page.getByText(/^힌트 공개까지/).waitFor({ state: "hidden" }));
  await snap("play-after-hint");
  if (fixture) {
    await desktop.evaluate(() => window.roomFixture.error());
    await status(desktop, "error").waitFor();
    assert.equal(await animation(desktop), "none");
  }
  for (const [index, song] of map.songs.entries()) {
    await desktop.getByText(`라운드 ${index + 1}/${map.songs.length}`, { exact: true }).waitFor();
    await desktop.locator(".room-play__timer").waitFor();
    if (index === 0) {
      await submit(mobile, "확실한 오답 테스트");
      await mobile.locator(".room-play__message").filter({ hasText: "확실한 오답 테스트" })
        .getByText("오답", { exact: true }).waitFor();
    }
    await submit(desktop, song.answers[0]);
    if (index === 0) {
      await both((page) => page.getByText("직전 정답", { exact: true }).waitFor());
      await snap("reveal");
      if (fixture) await desktop.waitForFunction(() => window.roomFixture.stops >= 1);
    }
  }
  await both((page) => heading(page, "최종 순위").waitFor());
  await desktop.locator(".room-play__ranking li").first().getByText("10점", { exact: true }).waitFor();
  await snap("result");
  assert.equal(await desktop.locator(".room-playback").count(), 0);
  console.log("Real Spring: Korean room direct guest join, ready, start, 10 rounds, answer reveal and final results passed.");
  for (const page of pages) await button(page, "나가기").click();
} finally {
  await browser.close();
}
