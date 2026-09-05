const serviceUrl = process.env.SERVICE_URL ?? "http://localhost:3000";

const response = await fetch(`${serviceUrl}/matters/intake`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    matterId: "matter-1042",
    clientId: "client-87",
    practiceArea: "employment",
  }),
});

const result = await response.json();
if (!response.ok) {
  console.error(result);
  process.exitCode = 1;
} else {
  console.log(result);
}
