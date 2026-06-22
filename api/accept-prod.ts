import "dotenv/config";
async function acceptRequest() {
  const API_BASE = "https://api.judo-arena.kz";

  // 1. Login as Coach
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@judo-arena.kz", password: "Pass123!" }),
  });
  const loginData = await loginRes.json();
  if (!loginData.accessToken) {
    console.error("Login failed:", loginData);
    return;
  }
  console.log("Logged in as coach.");

  // 2. Get join requests
  const reqsRes = await fetch(`${API_BASE}/api/join-requests/coach`, {
    headers: { Authorization: `Bearer ${loginData.accessToken}` },
  });
  const requests = await reqsRes.json();
  console.log("Found requests:", requests.length);

  // 3. Find pending request for rr.01@...
  const target = requests.find(
    (r: any) =>
      r.athlete?.email === "rr.01@almaty-demo.demo.judo-arena.kz" &&
      r.status === "PENDING",
  );
  if (!target) {
    console.log("No pending request found for rr.01. Maybe already accepted?");
    return;
  }

  // 4. Accept
  const acceptRes = await fetch(
    `${API_BASE}/api/join-requests/${target.id}/review`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginData.accessToken}`,
      },
      body: JSON.stringify({ approve: true }),
    },
  );
  const acceptData = await acceptRes.json();
  console.log("Accept result:", acceptData);
}
acceptRequest().catch(console.error);
