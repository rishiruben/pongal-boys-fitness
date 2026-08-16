import prisma from "../src/lib/db";

async function main() {
  const args = process.argv.slice(2);
  let dateStr = args[0];

  if (!dateStr) {
    // Default to yesterday
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dateStr = `${year}-${month}-${day}`;
  }

  // Validate date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    console.error("Error: Date must be in YYYY-MM-DD format.");
    process.exit(1);
  }

  // Fetch all users
  const users = await prisma.user.findMany();

  if (users.length === 0) {
    console.log(JSON.stringify({ error: "No users found in the database." }, null, 2));
    process.exit(0);
  }

  const evaluationData = [];

  for (const user of users) {
    // Fetch daily log for this user
    const dailyLog = await prisma.dailyLog.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: dateStr,
        },
      },
    });

    // Fetch workouts for this user on this day
    const workouts = await prisma.workout.findMany({
      where: {
        userId: user.id,
        date: dateStr,
      },
    });

    evaluationData.push({
      userId: user.id,
      name: user.name,
      targets: {
        targetCalories: user.targetCalories,
        targetActiveMinutes: user.targetActiveMinutes,
        targetSteps: user.targetSteps,
      },
      actuals: {
        steps: dailyLog?.steps ?? 0,
        activeMinutes: dailyLog?.activeMinutes ?? 0,
        caloriesBurned: dailyLog?.caloriesBurned ?? 0,
        foodLog: dailyLog?.foodLog ?? "No food logged",
        caloriesConsumed: dailyLog?.caloriesConsumed ?? 0,
        proteinConsumed: dailyLog?.proteinConsumed ?? 0,
        carbsConsumed: dailyLog?.carbsConsumed ?? 0,
        fatConsumed: dailyLog?.fatConsumed ?? 0,
      },
      workouts: workouts.map(w => ({
        title: w.title,
        type: w.type,
        duration: w.duration,
        distance: w.distance,
        avgHeartRate: w.avgHeartRate ?? "N/A",
        calories: w.calories ?? 0,
        relativeEffort: w.relativeEffort ?? "N/A",
        source: w.source,
      })),
    });
  }

  // Now, construct the LLM Prompt
  const prompt = `
SYSTEM: You are the Workout and Food Challenge Scoring Oracle. Your job is to evaluate each participant's health, exercise, and food logging for a single day, relative to their personal goals/targets, and output a normalized score from 0 to 100 for each user.

SCORING CRITERIA (Equitable & Relative):
1. Exercise & Steps (40 points max):
   - Evaluate active minutes and steps against their target. Hitting target = full points. Exceeding target = bonus appreciation.
   - Workouts logged (duration, heart rate, type) should be factored in. Harder/longer workouts can offset lower steps or vice-versa.
2. Nutrition & Food Logging (40 points max):
   - Look at the actual meal logs, calories, and macronutrients consumed relative to target.
   - For calorie deficits/weight loss targets: staying within deficit = full points. Severe surpluses or eating only unhealthy food (junk, heavy processed sugar, high fat without protein) = deductions.
   - For muscle building: check protein targets.
   - If no food is logged, score 0 for the food portion.
3. Habit Consistency & Goal Alignment (20 points max):
   - How well did their choices today align with their stated goal?
   - Clean, healthy meals, well-balanced macros, and active movement.

NORMALIZATION RULE:
- Do not favor individuals who run marathons over individuals doing light walking/recovery.
- If a user with an active recovery goal of 5,000 steps and 20 active minutes meets their target, they should receive a score close to 100.
- If a user with an endurance goal of 12,000 steps and 60 active minutes only gets 9,000 steps and 40 active minutes, their score should be lower (e.g., 75), even though their raw active numbers are higher than the recovery user.

OUTPUT SCHEMA:
You MUST respond with a valid JSON array. Each element in the array must match this schema:
[
  {
    "userId": "string (the user's unique ID)",
    "name": "string (the user's name)",
    "date": "${dateStr}",
    "score": "integer (0 to 100)",
    "rationale": "string (1-2 sentences explaining why this score was awarded, referencing their goals vs actuals)",
    "socialMessage": "string (A short, humorous, or engaging roast or boast about their day. Be light-hearted and social. E.g., 'Alice crushed her targets before lunch while Bob is still looking for his running shoes.')"
  }
]

Do not output any markdown code blocks, text wrapper, or explanations outside of the JSON array. Output ONLY the raw JSON array.

EVALUATION DATA FOR DATE: ${dateStr}
\`\`\`json
${JSON.stringify(evaluationData, null, 2)}
\`\`\`
`;

  console.log(prompt.trim());
}

main()
  .catch((e) => {
    console.error("Error running evaluation CLI:", e);
    process.exit(1);
  });
