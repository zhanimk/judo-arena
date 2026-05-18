/**
 * RBAC middleware — проверка ролей.
 *
 * Использование:
 *   app.get("/admin/stuff", { preHandler: [authenticate, authorize("ADMIN")] }, handler);
 *   app.get("/club-stuff", { preHandler: [authenticate, authorize("ADMIN", "COACH")] }, handler);
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import type { UserRole } from "@prisma/client";

export function authorize(...allowedRoles: UserRole[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Сначала войдите в систему" });
    }
    if (!allowedRoles.includes(request.user.role)) {
      return reply.code(403).send({
        error: "FORBIDDEN",
        message: `Эта операция доступна только ролям: ${allowedRoles.join(", ")}`,
      });
    }
  };
}
