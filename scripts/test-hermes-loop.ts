import { execSync } from "child_process";
import * as fs from "fs";
import prisma from "../src/lib/db";

async function main() {
  console.log("=== Starting Hermes Loop Integration Test ===");

  // 1. Ensure the database is seeded first
  console.log("Step 1: Running database seed...");
  execSync("npm run seed", { stdio: "inherit" });

  // 2. Test evaluate-day script
  console.log("\nStep 2: Testing 'evaluate-day' CLI script output...");
  const date = "2026-08-14";
  const promptOutput = execSync(`npm run evaluate-day -- ${date}`).toString();

  // Verify prompt contains expected keywords and data
  if (!promptOutput.includes("SYSTEM: You are the Workout and Food Challenge Scoring Oracle")) {
    throw new Error("FAIL: Evaluation prompt does not contain the system role description.");
  }
  if (!promptOutput.includes("Alice Smith") || !promptOutput.includes("Bob Jones") || !promptOutput.includes("Charlie Brown")) {
    throw new Error("FAIL: Evaluation data does not list all seeded user names.");
  }
  if (!promptOutput.includes("Oatmeal, banana") || !promptOutput.includes("Avocado toast") || !promptOutput.includes("pizza")) {
    throw new Error("FAIL: Evaluation data does not list meals from daily logs.");
  }
  console.log("✓ 'evaluate-day' script verified. Structured prompt successfully generated.");

  // 3. Mock the Hermes Agent LLM evaluation response
  console.log("\nStep 3: Simulating Hermes Agent LLM JSON response...");
  
  // Find users in the db to get their exact IDs
  const users = await prisma.user.findMany();
  const alice = users.find(u => u.name.includes("Alice"));
  const bob = users.find(u => u.name.includes("Bob"));
  const charlie = users.find(u => u.name.includes("Charlie"));

  if (!alice || !bob || !charlie) {
    throw new Error("FAIL: Could not locate seeded users in database.");
  }

  // Construct a mock LLM output array
  const mockLlmResponse = [
    {
      userId: alice.id,
      name: alice.name,
      date: date,
      score: 95,
      rationale: "Alice hit her targets and logged healthy, clean high-protein meals.",
      socialMessage: "Alice is leading the pack! Clean eating and solid training today."
    },
    {
      userId: bob.id,
      name: bob.name,
      date: date,
      score: 88,
      rationale: "Bob met his active recovery step goals and kept a clean calorie deficit.",
      socialMessage: "Bob is highly consistent, great active recovery pace!"
    },
    {
      userId: charlie.id,
      name: charlie.name,
      date: date,
      score: 45,
      rationale: "Charlie missed steps slightly and had excessive sugar and fast food, exceeding targets.",
      socialMessage: "Charlie had a pizza party instead of a workouts session. Let's step it up tomorrow!"
    }
  ];

  const jsonStr = JSON.stringify(mockLlmResponse, null, 2);
  const tempFile = "./temp_scores.json";
  fs.writeFileSync(tempFile, jsonStr, "utf-8");

  // 4. Test save-scores script by passing the mock JSON response file
  console.log("\nStep 4: Executing 'save-scores' CLI script with mock LLM JSON file...");
  try {
    execSync(`npm run save-scores -- ${tempFile}`, { stdio: "inherit" });
    console.log("✓ 'save-scores' script executed successfully.");
  } finally {
    // Ensure cleanup of the temporary file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }

  // 5. Verify database updates
  console.log("\nStep 5: Verifying data in database...");
  const scores = await prisma.dailyScore.findMany({
    where: { date },
  });

  if (scores.length !== 3) {
    throw new Error(`FAIL: Expected 3 daily scores saved, found ${scores.length}`);
  }

  const aliceScore = scores.find(s => s.userId === alice.id);
  const bobScore = scores.find(s => s.userId === bob.id);
  const charlieScore = scores.find(s => s.userId === charlie.id);

  if (!aliceScore || aliceScore.score !== 95 || !aliceScore.socialMessage.includes("leading the pack")) {
    throw new Error("FAIL: Alice's score record was not saved correctly.");
  }

  if (!bobScore || bobScore.score !== 88 || !bobScore.rationale.includes("recovery")) {
    throw new Error("FAIL: Bob's score record was not saved correctly.");
  }

  if (!charlieScore || charlieScore.score !== 45 || !charlieScore.socialMessage.includes("pizza party")) {
    throw new Error("FAIL: Charlie's score record was not saved correctly.");
  }

  console.log("✓ Database validation successful. All scores, rationales, and social messages match simulated LLM output!");
  console.log("\n=== HERMES LOOP INTEGRATION TEST PASSED SUCCESSFULLY! ===");
}

main()
  .catch((e) => {
    console.error("\nFAIL: Test run failed with error:", e.message);
    process.exit(1);
  });
