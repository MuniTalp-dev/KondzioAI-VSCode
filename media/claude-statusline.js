// Optional Claude Code statusLine adapter. It stores only documented rate-limit fields; never credentials or session data.
const { mkdirSync, writeFileSync, renameSync } = require("node:fs");
const { dirname, join } = require("node:path");
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { input += chunk; });
process.stdin.on("end", () => {
  try {
    const value = JSON.parse(input), output = process.env.KONDZIO_AI_CLAUDE_USAGE_PATH || join(process.env.LOCALAPPDATA || process.cwd(), "KondzioAI", "claude-usage.json");
    const safe = { version: value.version, rate_limits: value.rate_limits };
    mkdirSync(dirname(output), { recursive: true }); const temporary = `${output}.tmp`; writeFileSync(temporary, JSON.stringify(safe), { encoding: "utf8", mode: 0o600 }); renameSync(temporary, output);
    const five = safe.rate_limits?.five_hour?.used_percentage, week = safe.rate_limits?.seven_day?.used_percentage;
    process.stdout.write([Number.isFinite(five) ? `5h: ${Math.round(five)}%` : "", Number.isFinite(week) ? `7d: ${Math.round(week)}%` : ""].filter(Boolean).join(" "));
  } catch { process.stdout.write(""); }
});
