/**
 * /judge — без токена.
 * Перенаправляет на главную, так как судья работает только через /judge/:token.
 */

import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/judge")({
  component: () => <Navigate to="/" />,
});
