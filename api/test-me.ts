import "dotenv/config";
async function testMe() {
  const loginRes = await fetch("http://127.0.0.1:4000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "rr.01@almaty-demo.demo.judo-arena.kz",
      password: "Pass123!",
    }),
  });
  const loginData = await loginRes.json();
  console.log(
    "Login User:",
    Object.keys(loginData.user),
    "Has club?",
    !!loginData.user.club,
  );

  const meRes = await fetch("http://127.0.0.1:4000/api/auth/me", {
    headers: { Authorization: `Bearer ${loginData.accessToken}` },
  });
  const meData = await meRes.json();
  console.log(
    "Me User:",
    Object.keys(meData.user),
    "Has club?",
    !!meData.user.club,
  );
}
testMe().catch(console.error);
