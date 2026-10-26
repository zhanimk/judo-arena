import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../src/lib/redis.js", () => ({
  redis: { set: vi.fn(), getdel: vi.fn(), del: vi.fn(), scan: vi.fn() },
}));
import { redis } from "../../src/lib/redis.js";
import {
  consumeRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} from "../../src/lib/refresh-store.js";
beforeEach(() => vi.resetAllMocks());
describe("refresh session storage", () => {
  it("consumes each refresh token only once", async () => {
    vi.mocked(redis.getdel)
      .mockResolvedValueOnce("1")
      .mockResolvedValueOnce(null);
    expect(await consumeRefreshToken("u", "jti")).toBe(true);
    expect(await consumeRefreshToken("u", "jti")).toBe(false);
    expect(redis.getdel).toHaveBeenCalledWith("refresh:u:jti");
  });
  it.each([
    [
      "refresh",
      () => consumeRefreshToken("u", "j"),
      () => vi.mocked(redis.getdel).mockRejectedValue(new Error("offline")),
    ],
    [
      "login",
      () => storeRefreshToken("u", "j"),
      () => vi.mocked(redis.set).mockRejectedValue(new Error("offline")),
    ],
    [
      "logout",
      () => revokeRefreshToken("u", "j"),
      () => vi.mocked(redis.del).mockRejectedValue(new Error("offline")),
    ],
    [
      "logout all",
      () => revokeAllUserTokens("u"),
      () => vi.mocked(redis.scan).mockRejectedValue(new Error("offline")),
    ],
  ] as const)(
    "%s fails explicitly when Redis is unavailable",
    async (_name, action, setup) => {
      setup();
      await expect(action()).rejects.toMatchObject({
        code: "AUTH_STORE_UNAVAILABLE",
        httpStatus: 503,
      });
    },
  );
});
