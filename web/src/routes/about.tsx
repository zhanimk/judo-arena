import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Code2, Database, Zap, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "Платформа туралы — Judo-Arena" },
      { name: "description", content: "Judo-Arena жобасы туралы: технологиялар, архитектура және стандарттар." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <section className="container mx-auto px-4 pt-20 pb-16 max-w-4xl">
        <div className="text-xs uppercase tracking-[0.3em] text-gold mb-3">Платформа туралы</div>
        <h1 className="font-display text-5xl md:text-6xl font-bold leading-tight">
          Спорт үшін жасалған.<br/><span className="text-gradient-gold italic">Стандарттарға негізделген.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
          Judo-Arena — Халықаралық дзюдо федерациясы (IJF) ережелеріне толық сай дзюдо жарыстарын өткізуге арналған кешенді шешім.
        </p>
      </section>

      <section className="container mx-auto px-4 pb-24 max-w-4xl space-y-6">
        {[
          { icon: Zap, t: "Real-time архитектура", d: "WebSocket байланыстары барлық құрылғыларда нәтижелердің лезде жаңаруын қамтамасыз етеді." },
          { icon: Database, t: "Сенімді деректер қоры", d: "PostgreSQL + Redis. Барлық деректер қорғалған, оқиғалар AuditLog-қа жазылады." },
          { icon: ShieldCheck, t: "Қауіпсіздік", d: "JWT-аутентификация, RBAC, bcrypt-хэштеу, әр сұранысқа Zod валидациясы." },
          { icon: Code2, t: "Заманауи стек", d: "TypeScript, React, Fastify, Prisma. Дамытуға ыңғайлы сапалы код." },
        ].map((b) => (
          <div key={b.t} className="glass rounded-xl p-7 flex gap-5 hover:border-gold/40 transition-colors">
            <div className="h-12 w-12 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
              <b.icon className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold">{b.t}</h3>
              <p className="text-muted-foreground mt-1">{b.d}</p>
            </div>
          </div>
        ))}
      </section>
      <SiteFooter />
    </div>
  );
}
