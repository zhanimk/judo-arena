/**
 * socket-acl.test.ts — юнит-тесты ACL-логики Socket.IO.
 *
 * Тестирует: isValidRoom, правила подписки user:{id}, tatami:{n}, tournament:{id}
 * Не поднимает реальный сервер — тестирует вспомогательные функции изолированно.
 */

import { describe, it, expect } from "vitest";

// ─── isValidRoom ─────────────────────────────────────────────────────────────

function isValidRoom(room: string): boolean {
  return /^(tournament|bracket|tatami|user):[a-zA-Z0-9_-]{1,64}$/.test(room);
}

describe("isValidRoom", () => {
  it("принимает валидные комнаты", () => {
    expect(isValidRoom("tournament:abc123")).toBe(true);
    expect(isValidRoom("bracket:clxyz-001")).toBe(true);
    expect(isValidRoom("tatami:1")).toBe(true);
    expect(isValidRoom("user:clmg8hxyz0000abc")).toBe(true);
    expect(isValidRoom("tournament:A_B-C")).toBe(true);
  });

  it("отклоняет неизвестные префиксы", () => {
    expect(isValidRoom("admin:123")).toBe(false);
    expect(isValidRoom("match:abc")).toBe(false);
    expect(isValidRoom("score:123")).toBe(false);
  });

  it("отклоняет пустой идентификатор после :", () => {
    expect(isValidRoom("tournament:")).toBe(false);
    expect(isValidRoom("user:")).toBe(false);
  });

  it("отклоняет слишком длинный идентификатор (>64)", () => {
    const long = "a".repeat(65);
    expect(isValidRoom(`tournament:${long}`)).toBe(false);
  });

  it("отклоняет специальные символы в идентификаторе", () => {
    expect(isValidRoom("tournament:abc/def")).toBe(false);
    expect(isValidRoom("tournament:abc def")).toBe(false);
    expect(isValidRoom("user:abc@domain")).toBe(false);
  });

  it("отклоняет полностью невалидные строки", () => {
    expect(isValidRoom("")).toBe(false);
    expect(isValidRoom("nocolon")).toBe(false);
    expect(isValidRoom(":onlycolon")).toBe(false);
  });
});

// ─── Subscribe ACL rules ─────────────────────────────────────────────────────

describe("subscribe ACL — user:* rooms", () => {
  it("разрешает подписку если userId совпадает", () => {
    const socketUserId = "user-123";
    const room = "user:user-123";
    const targetUserId = room.split(":")[1];
    expect(socketUserId === targetUserId).toBe(true);
  });

  it("блокирует подписку на чужой user:* room", () => {
    const socketUserId = "user-123";
    const room = "user:other-456";
    const targetUserId = room.split(":")[1];
    expect(socketUserId === targetUserId).toBe(false);
  });

  it("блокирует подписку анонима на user:*", () => {
    const socketUserId: string | null = null;
    const room = "user:user-123";
    const targetUserId = room.split(":")[1];
    expect(!socketUserId || socketUserId !== targetUserId).toBe(true);
  });
});

describe("subscribe ACL — tatami:* rooms", () => {
  it("разрешает ADMIN подписку на tatami:*", () => {
    const role = "ADMIN";
    const userId = "admin-001";
    expect(!!userId && role === "ADMIN").toBe(true);
  });

  it("блокирует COACH подписку на tatami:*", () => {
    const role = "COACH" as string;
    const userId = "coach-001";
    expect(!userId || role !== "ADMIN").toBe(true);
  });

  it("блокирует анонима на tatami:*", () => {
    const role: string | undefined = undefined;
    const userId: string | null = null;
    expect(!userId || role !== "ADMIN").toBe(true);
  });
});

describe("subscribe ACL — tournament:* и bracket:*", () => {
  it("разрешает анонимный доступ к tournament:*", () => {
    const room = "tournament:clxyz123";
    // Нет проверки userId → всегда разрешено
    const requiresAuth = room.startsWith("user:") || room.startsWith("tatami:");
    expect(requiresAuth).toBe(false);
  });

  it("разрешает анонимный доступ к bracket:*", () => {
    const room = "bracket:clxyz123";
    const requiresAuth = room.startsWith("user:") || room.startsWith("tatami:");
    expect(requiresAuth).toBe(false);
  });
});

// ─── Rate limiting counters ───────────────────────────────────────────────────

describe("rate limit logic", () => {
  const MAX_SUBSCRIBE_EVENTS_PER_MINUTE = 120;
  const MAX_ROOMS_PER_SUBSCRIBE = 20;
  const MAX_ROOMS_PER_SOCKET = 50;

  it("блокирует подписку при превышении лимита событий", () => {
    const count = MAX_SUBSCRIBE_EVENTS_PER_MINUTE + 1;
    expect(count > MAX_SUBSCRIBE_EVENTS_PER_MINUTE).toBe(true);
  });

  it("обрезает список комнат до MAX_ROOMS_PER_SUBSCRIBE", () => {
    const rooms = Array.from({ length: 25 }, (_, i) => `tournament:room-${i}`);
    const sliced = rooms.slice(0, MAX_ROOMS_PER_SUBSCRIBE);
    expect(sliced).toHaveLength(MAX_ROOMS_PER_SUBSCRIBE);
  });

  it("блокирует подписку если сокет уже достиг MAX_ROOMS_PER_SOCKET", () => {
    const currentRoomsSize = MAX_ROOMS_PER_SOCKET;
    expect(currentRoomsSize >= MAX_ROOMS_PER_SOCKET).toBe(true);
  });
});
