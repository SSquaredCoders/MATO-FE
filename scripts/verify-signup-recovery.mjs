import assert from "node:assert/strict";
import { chromium } from "playwright";
import { preview } from "vite";

const register = "/api/users/register";
const login = "/api/users/login";
const user = { id: 1, userId: "signup-fixture", nickname: "Fixture", role: "USER" };
const password = "LocalOnly42!";
const app = await preview({ preview: { host: "127.0.0.1", port: 0 } });
const origin = new URL(app.resolvedUrls.local[0]).origin;
let browser;

try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL });

  for (const failure of ["none", "register network", "register HTTP", "login network", "login HTTP"]) {
    const page = await browser.newPage({ serviceWorkers: "block" });
    const posts = [];
    page.setDefaultTimeout(10_000);

    await page.route("**/*", (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      if (request.method() !== "POST") return route.fulfill({ status: 401 });

      posts.push(url.pathname);
      const failedRequest = (url.pathname === register && failure.startsWith("register"))
        || (url.pathname === login && failure.startsWith("login") && posts.length === 2);
      if (failedRequest && failure.endsWith("network")) return route.abort("failed");
      if (failedRequest) return route.fulfill({ status: 400, body: "Fixture API error" });
      return route.fulfill({ json: user, headers: { Authorization: "Bearer fixture-only" } });
    });

    await page.goto(`${origin}/signup`);
    const form = page.locator("form");
    const fields = form.locator("input");
    for (const [index, value] of [user.userId, user.nickname, password, password].entries()) {
      await fields.nth(index).fill(value);
    }
    await form.getByRole("button", { name: "회원가입 후 바로 로그인" }).click();

    const detail = failure.endsWith("network") ? "Failed to fetch" : "Fixture API error";
    if (failure === "none") {
      await page.waitForURL("**/maps");
      assert.deepEqual(posts, [register, login]);
    } else if (failure.startsWith("register")) {
      await page.getByText(`회원가입 요청에 실패했습니다. ${detail}`, { exact: true }).waitFor();
      assert.deepEqual(posts, [register]);
      assert.equal(await fields.count(), 4);
    } else {
      await page.getByText(`계정은 생성됐지만 자동 로그인에 실패했습니다. 다시 가입하지 말고 로그인해 주세요. ${detail}`, { exact: true }).waitFor();
      assert.deepEqual(posts, [register, login]);
      assert.equal(await fields.count(), 2);
      assert.equal(await fields.first().inputValue(), user.userId);
      assert.equal(await fields.last().inputValue(), "");
      await fields.last().fill(password);
      await form.getByRole("button", { name: "로그인", exact: true }).click();
      await page.waitForURL("**/maps");
      assert.deepEqual(posts, [register, login, login]);
    }

    console.log(`Verified: ${failure === "none" ? "successful signup and automatic login" : failure}`);
    await page.context().close();
  }
} finally {
  await browser?.close();
  await app.close();
}
