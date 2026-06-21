const fs = require("fs");

const transcriptPath =
  "/Users/zhanetta/.gemini/antigravity-ide/brain/afec13e8-21ab-463e-a81a-9aea0693416e/.system_generated/logs/transcript.jsonl";
const lines = fs
  .readFileSync(transcriptPath, "utf8")
  .split("\n")
  .filter(Boolean);

let appliedCount = 0;

for (const line of lines) {
  const step = JSON.parse(line);
  if (
    step.type !== "PLANNER_RESPONSE" ||
    step.status !== "DONE" ||
    !step.tool_calls
  )
    continue;

  // We only care about tool calls made after 2026-06-21T08:00:00Z to replay today's work
  if (new Date(step.created_at) < new Date("2026-06-21T08:00:00Z")) continue;

  for (const call of step.tool_calls) {
    if (
      call.name === "replace_file_content" ||
      call.name === "multi_replace_file_content"
    ) {
      try {
        const file = JSON.parse(call.args.TargetFile);
        if (!fs.existsSync(file)) {
          console.log(`File not found: ${file}`);
          continue;
        }
        let content = fs.readFileSync(file, "utf8");

        let changed = false;

        if (call.name === "replace_file_content") {
          const target = JSON.parse(call.args.TargetContent);
          const replacement = JSON.parse(call.args.ReplacementContent);
          if (content.includes(target)) {
            content = content.replace(target, replacement);
            changed = true;
          }
        } else if (call.name === "multi_replace_file_content") {
          const chunks = JSON.parse(call.args.ReplacementChunks);
          for (const chunk of chunks) {
            if (content.includes(chunk.TargetContent)) {
              content = content.replace(
                chunk.TargetContent,
                chunk.ReplacementContent,
              );
              changed = true;
            }
          }
        }

        if (changed) {
          fs.writeFileSync(file, content);
          console.log(`Applied patch to ${file} from step ${step.step_index}`);
          appliedCount++;
        }
      } catch (e) {
        console.error(
          `Error applying tool call in step ${step.step_index}:`,
          e.message,
        );
      }
    }
  }
}

console.log(`Recovery complete. Applied ${appliedCount} patches.`);
