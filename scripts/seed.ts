import prisma from "../src/lib/db";

async function main() {
  console.log("Seeding database...");

  // Clear existing data (in order of dependencies)
  await prisma.dailyScore.deleteMany({});
  await prisma.workout.deleteMany({});
  await prisma.dailyLog.deleteMany({});
  await prisma.user.deleteMany({});

  const alice = await prisma.user.create({
    data: {
      name: "Alice Smith",
      email: "alice@example.com",
      targetCalories: 2200,
      targetActiveMinutes: 45,
      targetSteps: 10000,
    },
  });

  const bob = await prisma.user.create({
    data: {
      name: "Bob Jones",
      email: "bob@example.com",
      targetCalories: 1800,
      targetActiveMinutes: 20,
      targetSteps: 6000,
    },
  });

  const charlie = await prisma.user.create({
    data: {
      name: "Charlie Brown",
      email: "charlie@example.com",
      targetCalories: 2600,
      targetActiveMinutes: 60,
      targetSteps: 12000,
    },
  });

  console.log("Seeded users:", [alice.name, bob.name, charlie.name]);

  // Seed a couple of workouts and food logs for yesterday (let's say 2026-08-14)
  const yesterday = "2026-08-14";

  // Alice: Met steps and active minutes, logged high protein food.
  await prisma.dailyLog.create({
    data: {
      userId: alice.id,
      date: yesterday,
      steps: 11200,
      activeMinutes: 50,
      caloriesBurned: 450,
      foodLog: "- Breakfast: Oatmeal, banana, protein shake (600 kcal)\n- Lunch: Chicken breast, brown rice, broccoli (700 kcal)\n- Snack: Greek yogurt, almonds (300 kcal)\n- Dinner: Salmon salad, sweet potato (600 kcal)",
      caloriesConsumed: 2200,
      proteinConsumed: 160,
      carbsConsumed: 210,
      fatConsumed: 65,
    },
  });
  await prisma.workout.create({
    data: {
      userId: alice.id,
      date: yesterday,
      title: "Morning Strength Training",
      type: "WeightTraining",
      duration: 45,
      distance: 0,
      avgHeartRate: 135,
      calories: 300,
      source: "manual",
    },
  });

  // Bob: Met steps, slight calorie deficit.
  await prisma.dailyLog.create({
    data: {
      userId: bob.id,
      date: yesterday,
      steps: 6500,
      activeMinutes: 25,
      caloriesBurned: 250,
      foodLog: "- Breakfast: Avocado toast, eggs (450 kcal)\n- Lunch: Turkey wrap, apple (500 kcal)\n- Snack: Protein bar (200 kcal)\n- Dinner: Lean beef stir-fry (600 kcal)",
      caloriesConsumed: 1750,
      proteinConsumed: 110,
      carbsConsumed: 160,
      fatConsumed: 55,
    },
  });

  // Charlie: Missed steps slightly, missed calories (ate too much pizza).
  await prisma.dailyLog.create({
    data: {
      userId: charlie.id,
      date: yesterday,
      steps: 9000,
      activeMinutes: 40,
      caloriesBurned: 350,
      foodLog: "- Breakfast: Egg and bacon sandwich (650 kcal)\n- Lunch: Double cheeseburger, fries, soda (1200 kcal)\n- Dinner: 3 slices of pepperoni pizza (900 kcal)\n- Snack: Ice cream (400 kcal)",
      caloriesConsumed: 3150,
      proteinConsumed: 95,
      carbsConsumed: 380,
      fatConsumed: 115,
    },
  });
  await prisma.workout.create({
    data: {
      userId: charlie.id,
      date: yesterday,
      title: "Evening Cycle",
      type: "Ride",
      duration: 35,
      distance: 12000,
      avgHeartRate: 142,
      calories: 400,
      source: "manual",
    },
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  });
