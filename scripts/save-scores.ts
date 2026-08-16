import prisma from "../src/lib/db";
import * as fs from "fs";

async function main() {
  const args = process.argv.slice(2);
  let jsonInput = "";

  // 1. Determine where to get JSON from (argument, file, or stdin)
  if (args.length > 0) {
    const arg = args[0];
    if (fs.existsSync(arg)) {
      // It's a file path
      jsonInput = fs.readFileSync(arg, "utf-8");
    } else {
      // It's a direct JSON string
      jsonInput = arg;
    }
  } else {
    // Read from stdin (piped input)
    jsonInput = fs.readFileSync(0, "utf-8");
  }

  if (!jsonInput.trim()) {
    console.error("Error: No JSON input provided.");
    console.error("Usage: npm run save-scores -- '<json_string>' or npm run save-scores -- path/to/file.json or cat file.json | npm run save-scores");
    process.exit(1);
  }

  let scores = [];
  try {
    // Strip markdown formatting if the LLM outputted it (e.g. ```json ... ```)
    let cleaned = jsonInput.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/```$/, "").trim();
    }
    scores = JSON.parse(cleaned);
  } catch (e: any) {
    console.error("Error parsing JSON input:", e.message);
    console.error("Raw input received:", jsonInput);
    process.exit(1);
  }

  if (!Array.isArray(scores)) {
    console.error("Error: Input JSON must be an array of score objects.");
    process.exit(1);
  }

  console.log(`Processing ${scores.length} scores...`);

  for (const item of scores) {
    const { userId, date, score, rationale, socialMessage } = item;

    if (!userId || !date || score === undefined || !rationale || !socialMessage) {
      console.error("Error: Invalid score object format. Missing fields in:", item);
      continue;
    }

    const parsedScore = parseInt(score, 10);
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 100) {
      console.error(`Error: Invalid score value "${score}" for user ${userId}. Must be between 0 and 100.`);
      continue;
    }

    try {
      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        console.error(`Error: User with ID "${userId}" not found in database.`);
        continue;
      }

      // Upsert DailyScore
      await prisma.dailyScore.upsert({
        where: {
          userId_date: {
            userId,
            date,
          },
        },
        update: {
          score: parsedScore,
          rationale,
          socialMessage,
        },
        create: {
          userId,
          date,
          score: parsedScore,
          rationale,
          socialMessage,
        },
      });

      console.log(`Saved score for ${user.name} on ${date}: ${parsedScore}/100`);
    } catch (dbErr: any) {
      console.error(`Error writing score for user ${userId} to database:`, dbErr.message);
    }
  }

  console.log("Completed saving scores.");
}

main()
  .catch((e) => {
    console.error("Error in save-scores script:", e);
    process.exit(1);
  });
