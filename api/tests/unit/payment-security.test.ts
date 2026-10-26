import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, env } = vi.hoisted(() => ({
  prisma: {
    application: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
  },
  env: {
    NODE_ENV: "production",
    APP_URL: "https://arena.test",
    FREEDOMPAY_MERCHANT_ID: "",
    FREEDOMPAY_SECRET_KEY: "",
  },
}));

vi.mock("../../src/lib/prisma.js", () => ({ prisma }));
vi.mock("../../src/lib/env.js", () => ({ env }));

import {
  initPayment,
  mockPaymentSuccess,
} from "../../src/services/payment.service.js";

describe("Payment authorization and production configuration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    env.NODE_ENV = "production";
    prisma.application.findUnique.mockResolvedValue({
      id: "application-1",
      clubId: "club-1",
      paymentStatus: "PENDING",
      paymentAmountKzt: 5000,
      tournament: { name: { ru: "Турнир" }, entryFeeKzt: 5000 },
    });
    prisma.user.findUnique.mockResolvedValue({
      id: "owner-1",
      role: "COACH",
      clubId: "club-1",
      clubRole: "OWNER",
    });
  });

  it("rejects payment initialization for another club", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "other-owner",
      role: "COACH",
      clubId: "club-2",
      clubRole: "OWNER",
    });
    await expect(
      initPayment("application-1", "other-owner"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
    expect(prisma.application.update).not.toHaveBeenCalled();
  });

  it("rejects an athlete attempting to initialize a club payment", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "athlete-1",
      role: "ATHLETE",
      clubId: "club-1",
    });
    await expect(
      initPayment("application-1", "athlete-1"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
    expect(prisma.application.update).not.toHaveBeenCalled();
  });

  it("does not create a mock payment in production without gateway credentials", async () => {
    await expect(initPayment("application-1", "owner-1")).rejects.toMatchObject(
      { code: "NOT_CONFIGURED", httpStatus: 503 },
    );
    expect(prisma.application.update).not.toHaveBeenCalled();
  });

  it("allows the club owner to create a development mock payment", async () => {
    env.NODE_ENV = "development";
    await expect(
      initPayment("application-1", "owner-1"),
    ).resolves.toMatchObject({ isMock: true });
    expect(prisma.application.update).toHaveBeenCalledOnce();
  });

  it("allows an administrator to initialize a development payment", async () => {
    env.NODE_ENV = "development";
    prisma.user.findUnique.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    await expect(
      initPayment("application-1", "admin-1"),
    ).resolves.toMatchObject({ isMock: true });
  });

  it("does not allow mock confirmation in production", async () => {
    await expect(mockPaymentSuccess("application-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
      httpStatus: 403,
    });
    expect(prisma.application.update).not.toHaveBeenCalled();
  });
});
