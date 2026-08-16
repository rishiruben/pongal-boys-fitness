import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let startDate = searchParams.get("startDate");
  let endDate = searchParams.get("endDate");

  // If no date range provided, default to the current week (Monday to Sunday)
  if (!startDate || !endDate) {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday...
    
    // Calculate Monday of the current week
    const monday = new Date(today);
    const diffToMonday = monday.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    monday.setDate(diffToMonday);
    
    // Calculate Sunday of the current week
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const pad = (num: number) => String(num).padStart(2, "0");
    
    startDate = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
    endDate = `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`;
  }

  try {
    const users = await prisma.user.findMany();

    const leaderboardData = [];

    for (const user of users) {
      // Fetch daily scores in the date range
      const scores = await prisma.dailyScore.findMany({
        where: {
          userId: user.id,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Fetch daily logs in the date range
      const logs = await prisma.dailyLog.findMany({
        where: {
          userId: user.id,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Fetch workouts in the date range
      const workouts = await prisma.workout.findMany({
        where: {
          userId: user.id,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
      const scoreCount = scores.length;
      const averageScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

      const totalSteps = logs.reduce((sum, l) => sum + l.steps, 0);
      const totalActiveMin = logs.reduce((sum, l) => sum + l.activeMinutes, 0);
      const totalCalBurned = logs.reduce((sum, l) => sum + l.caloriesBurned, 0);
      const totalCalConsumed = logs.reduce((sum, l) => sum + l.caloriesConsumed, 0);

      const daysCount = logs.length || 1;

      leaderboardData.push({
        userId: user.id,
        name: user.name,
        email: user.email,
        totalScore,
        averageScore,
        stats: {
          avgSteps: Math.round(totalSteps / daysCount),
          avgActiveMinutes: Math.round(totalActiveMin / daysCount),
          avgCaloriesBurned: Math.round(totalCalBurned / daysCount),
          avgCaloriesConsumed: Math.round(totalCalConsumed / daysCount),
          workoutsCount: workouts.length,
        },
        scores: scores.map(s => ({
          date: s.date,
          score: s.score,
          rationale: s.rationale,
          socialMessage: s.socialMessage,
        })),
      });
    }

    // Sort by totalScore descending
    leaderboardData.sort((a, b) => b.totalScore - a.totalScore);

    return NextResponse.json({
      startDate,
      endDate,
      leaderboard: leaderboardData,
    });
  } catch (error: any) {
    console.error("Error generating leaderboard:", error);
    return NextResponse.json({ error: "Failed to generate leaderboard" }, { status: 500 });
  }
}
