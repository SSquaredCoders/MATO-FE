import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";

const real = process.env.MATO_TEST_REAL === "1";
const origin = process.env.MATO_FE_URL || "http://localhost:5173";
const api = "http://localhost:8080";
const screenshotDir = process.env.MATO_TEST_SCREENSHOTS;
const user = { id: 1, userId: "map-studio-test", nickname: "테스트 제작자", role: "USER" };
const longMapName = "아주 긴 한국어 맵 이름으로 좁은 화면에서도 제목과 입력 흐름이 읽히는지 확인";
const makeSong = (index) => ({
  clue: `${index + 1}번째 곡의 힌트`,
  title: index === 0 ? "긴 제목의 한국어 테스트 곡 이름 확인용" : `테스트 곡 ${index + 1}`,
  artist: `테스트 가수 ${index + 1}`,
  answers: [`정답 ${index + 1}`, `별칭 ${index + 1}`],
  audioSourceType: "youtube",
  audioSourceValue: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  audioSourceLabel: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  clipStartSeconds: 5,
  clipEndSeconds: 25,
});
const songs = Array.from({ length: 12 }, (_, index) => makeSong(index));
const mapDetail = {
  id: 1,
  name: longMapName,
  description: "맵 소개와 곡 정보가 포함된 편집 테스트 맵입니다.",
  createdBy: user.nickname,
  difficulty: "normal",
  visibility: "public",
  songCount: songs.length,
  showMediaControls: true,
  songOrderMode: "author-order",
  answerMode: "single-lock",
  roundFlowMode: "advance-on-correct",
  roundTimeLimitSeconds: 30,
  skipVotesRequired: 2,
  hintRevealDelaySeconds: 8,
  songs,
};
const mapSummary = {
  id: mapDetail.id,
  name: mapDetail.name,
  songCount: mapDetail.songCount,
  difficulty: mapDetail.difficulty,
  visibility: mapDetail.visibility,
  createdBy: mapDetail.createdBy,
};

function contrastRatio(foreground, background) {
  const luminance = (color) => {
    const values = color.match(/\d+/g).slice(0, 3).map(Number).map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

async function preparePage(browser, viewport, initialMaps) {
  const page = await browser.newPage({ viewport });
  const writes = [];
  await page.addInitScript((sessionUser) => {
    localStorage.setItem(
      "mato-auth-session",
      JSON.stringify({ state: { user: sessionUser, accessToken: null }, version: 0 }),
    );
  }, user);
  await page.route(/youtube\.com|youtu\.be|ytimg\.com/, (route) =>
    route.fulfill({ contentType: "text/html", body: "<html><body></body></html>" }),
  );
  await page.route("**/api/v2/maps**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    if (request.method() === "POST" && pathname === "/api/v2/maps") {
      const body = request.postDataJSON();
      writes.push({ method: "POST", body });
      return route.fulfill({
        json: {
          ...body,
          id: 55,
          songCount: body.songs.length,
          songs: body.songs.map((song, index) => ({ ...song, id: index + 1, songOrder: index })),
        },
      });
    }
    if (request.method() === "PUT" && pathname === "/api/v2/maps/1") {
      const body = request.postDataJSON();
      writes.push({ method: "PUT", body });
      return route.fulfill({
        json: {
          ...mapDetail,
          ...body,
          id: 1,
          songCount: body.songs.length,
          songs: body.songs.map((song, index) => ({ ...song, id: index + 1, songOrder: index })),
        },
      });
    }
    if (pathname.endsWith("/songs")) {
      const pageIndex = Number(url.searchParams.get("page") || 0);
      const size = Number(url.searchParams.get("size") || 25);
      const items = mapDetail.songs.map((song, index) => ({
        id: index + 1,
        songOrder: index,
        clue: song.clue,
        title: song.title,
        artist: song.artist,
        audioSourceType: song.audioSourceType,
        audioSourceLabel: song.audioSourceLabel,
        clipStartSeconds: song.clipStartSeconds,
        clipEndSeconds: song.clipEndSeconds,
        answerCount: song.answers.length,
      }));
      return route.fulfill({
        json: {
          page: pageIndex,
          size,
          totalElements: items.length,
          totalPages: Math.ceil(items.length / size),
          query: null,
          items: items.slice(pageIndex * size, pageIndex * size + size),
        },
      });
    }
    if (/\/api\/v2\/maps\/1$/.test(pathname)) {
      return route.fulfill({ json: mapDetail });
    }
    return route.fulfill({ json: initialMaps });
  });
  return { page, writes };
}

async function localPage(browser, viewport) {
  assert.equal(new URL(origin).origin, "http://localhost:5173", "real writes are local only");
  const page = await browser.newPage({ viewport, serviceWorkers: "block" });
  const nonce = randomBytes(4).toString("hex");
  const userId = `mw${nonce}`;
  const nickname = `MW${nonce}`;
  const password = `A9a!${randomBytes(4).toString("hex")}`;
  const registration = await page.request.post(`${api}/api/users/register`, {
    data: { userId, nickname, password, confirmPassword: password },
  });
  assert.ok(registration.ok(), `local test account: ${registration.status()}`);
  await page.goto(`${origin}/account`);
  const form = page.locator("form");
  await form.locator("input").nth(0).fill(userId);
  await form.locator("input").nth(1).fill(password);
  await form.locator("button[type=submit]").click();
  await page.waitForURL("**/maps");
  return { page, nonce };
}

async function measure(page, name, inputCount) {
  const metrics = await page.locator(".map-wizard").evaluate((root) => {
    const row = root.querySelector(".map-wizard__song-row");
    const body = root.querySelector(".map-wizard__body");
    const visible = (el) => !!el.getClientRects().length && getComputedStyle(el).visibility === "visible";
    const text = body.querySelector("label span") ?? body.querySelector("p") ?? body;
    return {
      inputs: [...body.querySelectorAll("input, select, textarea")].filter(visible).length,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      font: getComputedStyle(root).fontSize,
      color: getComputedStyle(text).color,
      background: getComputedStyle(document.body).backgroundColor,
      row: row && row.getBoundingClientRect().height,
      line: row && getComputedStyle(row).borderBottomWidth,
    };
  });
  assert.equal(metrics.overflow, false, `${name} no horizontal overflow`);
  assert.equal(metrics.inputs, inputCount, `${name} visible form inputs`);
  assert.equal(metrics.font, "14px");
  assert.ok(contrastRatio(metrics.color, metrics.background) >= 4.5, `${name} sampled text contrast`);
  if (metrics.row) {
    assert.ok(metrics.row >= 40 && metrics.row <= 44, `${name} song row height`);
    assert.equal(metrics.line, "1px");
  }
  if (screenshotDir) {
    await fs.mkdir(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, `map-wizard-${page.viewportSize().width}-${name}.png`), fullPage: true });
  }
  console.log(`${page.viewportSize().width}px ${name}: ${JSON.stringify(metrics)}`);
}

async function fillSong(page, index) {
  const song = makeSong(index);
  await page.locator("#song-field-title").fill(song.title);
  await page.locator("#song-field-artist").fill(song.artist);
  await page.locator("#song-field-clue").fill(song.clue);
  await page.locator("#song-field-answers").fill(song.answers.join(", "));
}

const browser = await chromium.launch({ channel: process.env.MATO_BROWSER_CHANNEL || "msedge" });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
    const { page, writes, nonce } = real ? await localPage(browser, viewport) : await preparePage(browser, viewport, [mapSummary]);
    page.setDefaultTimeout(10000);
    if (!real) await page.goto(`${origin}/maps`);
    await page.getByRole("button", { name: "+ 새 맵" }).click();
    const wizard = page.locator(".map-wizard");
    const button = (name) => wizard.getByRole("button", { name, exact: true });
    const next = () => button("다음").click();
    const name = real ? `검증 맵 ${nonce}` : longMapName;
    await page.locator("#map-field-name").waitFor();
    await measure(page, "01-basics", 4);
    await next();
    await page.locator("#map-field-name[aria-invalid=true]").waitFor();
    assert.equal(await page.locator("#map-field-name").evaluate((el) => el === document.activeElement), true);
    await page.locator("#map-field-name").fill(name);
    await page.locator("#map-field-description").fill("단계형 편집 흐름을 확인합니다.");
    await next();
    await page.waitForURL("**/songs");
    await next();
    await page.locator("#map-add-song-error").waitFor();
    await page.goBack();
    assert.equal(await page.locator("#map-field-name").inputValue(), name);
    await next();
    await page.waitForURL("**/songs");
    const links = wizard.locator("textarea");
    const firstUrl = makeSong(0).audioSourceValue;
    const secondUrl = "https://youtu.be/9bZkp7q19f0";
    await links.click();
    await links.fill(`${firstUrl}\n${secondUrl}`);
    assert.equal(await links.inputValue(), `${firstUrl}\n${secondUrl}`);
    await button("조회 없이 링크 담기").click();
    await wizard.locator(".map-wizard__song-row").nth(1).waitFor().catch(async (error) => {
      throw new Error(`${error.message}\n${await wizard.innerText()}`);
    });
    assert.equal(await wizard.locator(".map-wizard__song-row").count(), 2);
    await measure(page, "02-songs", 1);
    await button("엑셀·텍스트").click();
    await measure(page, "02-import", 3);
    await wizard.getByLabel("곡 줄 붙여넣기").fill(
      ["일괄 추가 곡", "테스트 가수", "힌트", "정답", "youtube", makeSong(0).audioSourceValue, "0", "30"].join("\t"),
    );
    await button("붙여넣은 곡 추가").click();
    assert.equal(await wizard.locator(".map-wizard__song-row").count(), 3);
    await wizard.getByLabel("3번 곡 관리").click();
    await button("복제").click();
    assert.equal(await wizard.locator(".map-wizard__song-row").count(), 4);
    await wizard.getByLabel("4번 곡 관리").click();
    await button("곡 삭제").click();
    assert.equal(await wizard.locator(".map-wizard__song-row").count(), 3);
    await next();
    await page.waitForURL("**/answers");
    await next();
    await page.locator("#song-field-title[aria-invalid=true]").waitFor();
    await fillSong(page, 0);
    await measure(page, "03-answers", 4);
    await button("음원·미리듣기·구간 설정").click();
    await measure(page, "03-source", 2);
    await button("미리듣기·구간").click();
    await wizard.getByLabel("시작 시점(초)").fill("5");
    await wizard.getByLabel("끝 시점(초)").fill("25");
    await measure(page, "03-clip", 2);
    await button("정답 입력으로").click();
    await button("다음 곡").click();
    await fillSong(page, 1);
    await button("이전 곡").click();
    assert.equal(await page.locator("#song-field-title").inputValue(), makeSong(0).title);
    await button("다음 곡").click();
    assert.equal(await page.locator("#song-field-title").inputValue(), makeSong(1).title);
    await next();
    await next();
    await page.waitForURL("**/rules");
    await measure(page, "04-rules", 4);
    await button("시간·스킵·힌트 설정").click();
    await measure(page, "04-extra", 3);
    await button("기본 규칙으로").click();
    await button("확인 단계로").click();
    await page.waitForURL("**/review");
    await wizard.getByText("모든 필수 항목을 입력했습니다.").waitFor();
    await measure(page, "05-review", 0);
    const post = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/v2/maps" && response.request().method() === "POST");
    await button("맵 만들기").click();
    const created = await post;
    assert.ok(created.ok(), `POST ${created.status()}: ${created.ok() ? "" : await created.text()}`);
    const payload = created.request().postDataJSON();
    assert.equal(payload.songs.length, 3);
    assert.deepEqual([payload.songs[0].clipStartSeconds, payload.songs[0].clipEndSeconds], [5, 25]);
    assert.deepEqual([payload.roundTimeLimitSeconds, payload.skipVotesRequired, payload.hintRevealDelaySeconds], [30, 2, 8]);
    await page.waitForURL("**/maps");
    const id = real ? (await created.json()).id : 1;
    if (real) {
      await page.locator(".map-browser__list").getByText(name, { exact: true }).waitFor();
      await page.getByRole("button", { name: "선택 맵 편집" }).click();
    } else await page.goto(`${origin}/edit-map/${id}/basics`);
    await page.waitForURL(`**/edit-map/${id}/basics`);
    await page.locator("#map-field-name").waitFor();
    await wizard.getByRole("button", { name: "5. 확인 및 저장", exact: true }).click();
    await wizard.getByRole("button", { name: "3. 곡별 정답", exact: true }).click();
    await page.locator("#song-field-title").fill("");
    await wizard.getByRole("button", { name: "5. 확인 및 저장", exact: true }).click();
    await button("1번 곡의 제목을 입력해 주세요.").click();
    await page.locator("#song-field-title[aria-invalid=true]").waitFor();
    await page.locator("#song-field-title").fill("수정된 곡 제목");
    await wizard.getByRole("button", { name: "5. 확인 및 저장", exact: true }).click();
    const put = page.waitForResponse((response) =>
      new URL(response.url()).pathname === `/api/v2/maps/${id}` && response.request().method() === "PUT");
    await button("변경 저장").click();
    const updated = await put;
    assert.ok(updated.ok(), `PUT ${updated.status()}: ${updated.ok() ? "" : await updated.text()}`);
    assert.equal(updated.request().postDataJSON().songs[0].title, "수정된 곡 제목");
    await page.waitForURL("**/maps");
    if (real) {
      await page.goto(`${origin}/edit-map/${id}/answers`);
      await page.locator("#song-field-title").waitFor();
      assert.equal(await page.locator("#song-field-title").inputValue(), "수정된 곡 제목");
    } else assert.deepEqual(writes.map(({ method }) => method), ["POST", "PUT"]);
    await page.goto(`${origin}/roadmap`);
    assert.equal(await page.locator(".qp-shell--workbench").count(), 0);
    console.log(`Passed ${real ? "local Spring" : "mocked"} create/edit at ${viewport.width}px`);
    await page.context().close();
  }
} finally {
  await browser.close();
}
