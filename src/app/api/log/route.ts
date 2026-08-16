import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const date = searchParams.get("date");

  if (!userId || !date) {
    return NextResponse.json({ error: "userId and date are required" }, { status: 400 });
  }

  try {
    // Get daily log
    let dailyLog = await prisma.dailyLog.findUnique({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
    });

    // If log doesn't exist, return a default mock object structure rather than failing
    if (!dailyLog) {
      dailyLog = {
        id: "",
        userId,
        date,
        steps: 0,
        activeMinutes: 0,
        caloriesBurned: 0,
        foodLog: "",
        caloriesConsumed: 0,
        proteinConsumed: 0,
        carbsConsumed: 0,
        fatConsumed: 0,
      };
    }

    // Get workouts
    const workouts = await prisma.workout.findMany({
      where: {
        userId,
        date,
      },
      orderBy: { createdAt: "asc" },
    });

    // Get evaluation/score if exists
    const dailyScore = await prisma.dailyScore.findUnique({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
    });

    return NextResponse.json({
      dailyLog,
      workouts,
      dailyScore,
    });
  } catch (error: any) {
    console.error("Error fetching logs:", error);
    return NextResponse.json({ error: "Failed to fetch log details" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, date, type, data } = body;

    if (!userId || !date || !type || !data) {
      return NextResponse.json({ error: "userId, date, type, and data are required" }, { status: 400 });
    }

    // Ensure user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (type === "activity") {
      const { steps, activeMinutes, caloriesBurned } = data;

      const log = await prisma.dailyLog.upsert({
        where: {
          userId_date: {
            userId,
            date,
          },
        },
        update: {
          steps: steps !== undefined ? parseInt(steps, 10) : undefined,
          activeMinutes: activeMinutes !== undefined ? parseInt(activeMinutes, 10) : undefined,
          caloriesBurned: caloriesBurned !== undefined ? parseInt(caloriesBurned, 10) : undefined,
        },
        create: {
          userId,
          date,
          steps: steps !== undefined ? parseInt(steps, 10) : 0,
          activeMinutes: activeMinutes !== undefined ? parseInt(activeMinutes, 10) : 0,
          caloriesBurned: caloriesBurned !== undefined ? parseInt(caloriesBurned, 10) : 0,
        },
      });

      return NextResponse.json({ success: true, log });
    }

    if (type === "food") {
      const { foodLog, caloriesConsumed, proteinConsumed, carbsConsumed, fatConsumed } = data;

      const log = await prisma.dailyLog.upsert({
        where: {
          userId_date: {
            userId,
            date,
          },
        },
        update: {
          foodLog: foodLog !== undefined ? foodLog : undefined,
          caloriesConsumed: caloriesConsumed !== undefined ? parseInt(caloriesConsumed, 10) : undefined,
          proteinConsumed: proteinConsumed !== undefined ? parseInt(proteinConsumed, 10) : undefined,
          carbsConsumed: carbsConsumed !== undefined ? parseInt(carbsConsumed, 10) : undefined,
          fatConsumed: fatConsumed !== undefined ? parseInt(fatConsumed, 10) : undefined,
        },
        create: {
          userId,
          date,
          foodLog: foodLog !== undefined ? foodLog : "",
          caloriesConsumed: caloriesConsumed !== undefined ? parseInt(caloriesConsumed, 10) : 0,
          proteinConsumed: proteinConsumed !== undefined ? parseInt(proteinConsumed, 10) : 0,
          carbsConsumed: carbsConsumed !== undefined ? parseInt(carbsConsumed, 10) : 0,
          fatConsumed: fatConsumed !== undefined ? parseInt(fatConsumed, 10) : 0,
        },
      });

      return NextResponse.json({ success: true, log });
    }

    if (type === "workout") {
      const { title, workoutType, duration, distance, avgHeartRate, calories } = data;

      if (!title || !workoutType || duration === undefined) {
        return NextResponse.json({ error: "title, workoutType, and duration are required for workouts" }, { status: 400 });
      }

      const workout = await prisma.workout.create({
        data: {
          userId,
          date,
          title,
          type: workoutType,
          duration: parseInt(duration, 10),
          distance: distance ? parseFloat(distance) : 0,
          avgHeartRate: avgHeartRate ? parseFloat(avgHeartRate) : null,
          calories: calories ? parseInt(calories, 10) : null,
          source: "manual",
        },
      });

      // Update activeMinutes and caloriesBurned in the DailyLog as well for convenience
      const dailyLog = await prisma.dailyLog.findUnique({
        where: {
          userId_date: {
            userId,
            date,
          },
        },
      });

      await prisma.dailyLog.upsert({
        where: {
          userId_date: {
            userId,
            date,
          },
        },
        update: {
          activeMinutes: (dailyLog?.activeMinutes ?? 0) + parseInt(duration, 10),
          caloriesBurned: (dailyLog?.caloriesBurned ?? 0) + (calories ? parseInt(calories, 10) : 0),
        },
        create: {
          userId,
          date,
          activeMinutes: parseInt(duration, 10),
          caloriesBurned: calories ? parseInt(calories, 10) : 0,
          steps: 0,
        },
      });

      return NextResponse.json({ success: true, workout });
    }

    if (type === "workout_delete") {
      const { id } = data;
      if (!id) {
        return NextResponse.json({ error: "Workout ID is required for deletion" }, { status: 400 });
      }

      const workout = await prisma.workout.findUnique({ where: { id } });
      if (!workout) {
        return NextResponse.json({ error: "Workout not found" }, { status: 404 });
      }

      await prisma.workout.delete({ where: { id } });

      // Re-calculate active minutes and calories burned in DailyLog from remaining workouts
      const remainingWorkouts = await prisma.workout.findMany({
        where: { userId, date },
      });

      const totalDuration = remainingWorkouts.reduce((sum, w) => sum + w.duration, 0);
      const totalCalories = remainingWorkouts.reduce((sum, w) => sum + (w.calories ?? 0), 0);

      const dailyLog = await prisma.dailyLog.findUnique({
        where: { userId_date: { userId, date } },
      });

      if (dailyLog) {
        await prisma.dailyLog.update({
          where: { userId_date: { userId, date } },
          data: {
            activeMinutes: totalDuration,
            caloriesBurned: totalCalories,
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid log type" }, { status: 400 });
  } catch (error: any) {
    console.error("Error writing logs:", error);
    return NextResponse.json({ error: "Failed to write log details" }, { status: 500 });
  }
}
