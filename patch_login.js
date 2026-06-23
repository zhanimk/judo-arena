const fs = require("fs");

let code = fs.readFileSync("web/src/routes/login.tsx", "utf8");

code = code.replace(
  `              <p\n                className="mt-5 text-base font-semibold leading-relaxed max-w-[300px]"\n                style={{ color: "rgba(255,255,255,0.78)" }}\n              >`,
  `              <p className="mt-5 text-base font-semibold leading-relaxed max-w-[300px] text-foreground/80">`,
);

code = code.replace(
  `                    <div\n                      className="text-[11px] font-bold uppercase tracking-widest mb-1.5"\n                      style={{ color: "rgba(255,255,255,0.55)" }}\n                    >`,
  `                    <div className="text-[11px] font-bold uppercase tracking-widest mb-1.5 text-muted-foreground">`,
);

fs.writeFileSync("web/src/routes/login.tsx", code);
