/**
 * /judge — layout route для /judge/$token.
 * Сам по себе перенаправляет на главную.
 */

import { createFileRoute, Navigate, Outlet, useParams } from "@tanstack/react-router";

function JudgeLayout() {
  // Если есть дочерний сегмент ($token) — рендерим его
  return <Outlet />;
}

export const Route = createFileRoute("/judge")({
  component: JudgeLayout,
});
