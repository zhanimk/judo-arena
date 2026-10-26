import { afterEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: { $transaction: vi.fn() },
}));
import { prisma } from "../../src/lib/prisma.js";
import { withSerializableMatchTransaction } from "../../src/services/match-transaction.js";
const conflict = () =>
  new Prisma.PrismaClientKnownRequestError("serialization aborted", {
    code: "P2034",
    clientVersion: "test",
  });
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});
describe("safe match transaction retries", () => {
  it("retries a confirmed aborted transaction and returns its committed result", async () => {
    vi.useFakeTimers();
    vi.mocked(prisma.$transaction)
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce("committed");
    const result = withSerializableMatchTransaction(async () => "committed");
    await vi.runAllTimersAsync();
    expect(await result).toBe("committed");
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
  it("never retries an ambiguous connection failure", async () => {
    const error = new Error("connection lost after commit");
    vi.mocked(prisma.$transaction).mockRejectedValue(error);
    await expect(
      withSerializableMatchTransaction(async () => "result"),
    ).rejects.toBe(error);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
  it("stops after bounded retries under sustained contention", async () => {
    vi.useFakeTimers();
    const error = conflict();
    vi.mocked(prisma.$transaction).mockRejectedValue(error);
    const assertion = expect(
      withSerializableMatchTransaction(async () => "result"),
    ).rejects.toBe(error);
    await vi.runAllTimersAsync();
    await assertion;
    expect(prisma.$transaction).toHaveBeenCalledTimes(9);
  });
});
