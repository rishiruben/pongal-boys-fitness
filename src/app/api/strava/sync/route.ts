import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, date } = body;

    if (!userId || !date) {
      return NextResponse.json({ error: "userId and date are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.stravaAccessToken) {
      return NextResponse.json({ error: "Strava is not connected for this user" }, { status: 400 });
    }

    // 1. Check if we are running in Simulator Mode (Mock Tokens)
    if (user.stravaAccessToken === "mock_access_token_abc123") {
      console.log(`Simulating Strava workout sync for user: ${user.name} on ${date}`);

      // Generate a mock workout (e.g. 50% chance of Run, 30% Ride, 20% WeightTraining)
      const rand = Math.random();
      let mockWorkout = null;

      if (rand < 0.5) {
        mockWorkout = {
          id: `mock-workout-run-${Date.now()}`,
          userId,
          date,
          title: "Lunch Run",
          type: "Run",
          duration: 35,
          distance: 5400, // 5.4 km
          avgHeartRate: 145,
          calories: 380,
          source: "strava",
        };
      } else if (rand < 0.8) {
        mockWorkout = {
          id: `mock-workout-ride-${Date.now()}`,
          userId,
          date,
          title: "Evening Road Ride",
          type: "Ride",
          duration: 60,
          distance: 22000, // 22 km
          avgHeartRate: 135,
          calories: 550,
          source: "strava",
        };
      } else {
        mockWorkout = {
          id: `mock-workout-lift-${Date.now()}`,
          userId,
          date,
          title: "Upper Body Strength",
          type: "WeightTraining",
          duration: 45,
          distance: 0,
          avgHeartRate: 115,
          calories: 250,
          source: "strava",
        };
      }

      // Save workout
      await prisma.workout.create({
        data: mockWorkout,
      });

      // Update DailyLog steps, activeMinutes, and caloriesBurned
      const dailyLog = await prisma.dailyLog.findUnique({
        where: { userId_date: { userId, date } },
      });

      // For runs/rides, generate steps or active minutes
      const additionalSteps = mockWorkout.type === "Run" ? 6500 : mockWorkout.type === "Ride" ? 1000 : 500;
      const additionalActiveMin = mockWorkout.duration;
      const additionalCalBurned = mockWorkout.calories;

      const log = await prisma.dailyLog.upsert({
        where: { userId_date: { userId, date } },
        update: {
          steps: (dailyLog?.steps ?? 0) + additionalSteps,
          activeMinutes: (dailyLog?.activeMinutes ?? 0) + additionalActiveMin,
          caloriesBurned: (dailyLog?.caloriesBurned ?? 0) + additionalCalBurned,
        },
        create: {
          userId,
          date,
          steps: additionalSteps,
          activeMinutes: additionalActiveMin,
          caloriesBurned: additionalCalBurned,
        },
      });

      return NextResponse.json({
        success: true,
        source: "simulator",
        workout: mockWorkout,
        dailyLog: log,
      });
    }

    // 2. Real Strava Sync Flow
    let token = user.stravaAccessToken;
    const expiresAt = user.stravaExpiresAt ?? 0;

    // Refresh token if expired
    if (Date.now() / 1000 >= expiresAt - 300) {
      console.log(`Refreshing Strava token for user: ${user.name}`);
      const clientId = process.env.STRAVA_CLIENT_ID;
      const clientSecret = process.env.STRAVA_CLIENT_SECRET;

      const refreshRes = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: user.stravaRefreshToken,
          grant_type: "refresh_token",
        }),
      });

      const refreshData = await refreshRes.json();

      if (refreshData.errors || !refreshData.access_token) {
        console.error("Strava token refresh failed:", refreshData);
        return NextResponse.json({ error: "Failed to refresh Strava access token" }, { status: 500 });
      }

      // Save refreshed tokens
      await prisma.user.update({
        where: { id: userId },
        data: {
          stravaAccessToken: refreshData.access_token,
          stravaRefreshToken: refreshData.refresh_token,
          stravaExpiresAt: refreshData.expires_at,
        },
      });

      token = refreshData.access_token;
    }

    // Fetch activities for that date
    // Calculate start/end of the day
    const startOfDay = new Date(`${date}T00:00:00Z`);
    const endOfDay = new Date(`${date}T23:59:59Z`);
    const afterEpoch = Math.floor(startOfDay.getTime() / 1000);
    const beforeEpoch = Math.floor(endOfDay.getTime() / 1000);

    const activitiesRes = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?before=${beforeEpoch}&after=${afterEpoch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (activitiesRes.status !== 200) {
      const errText = await activitiesRes.text();
      console.error("Failed to fetch Strava activities:", errText);
      return NextResponse.json({ error: "Failed to fetch activities from Strava API" }, { status: 500 });
    }

    const activities = await activitiesRes.json();
    console.log(`Fetched ${activities.length} activities from Strava for user ${user.name}`);

    const syncedWorkouts = [];
    let addedDuration = 0;
    let addedCalories = 0;

    for (const activity of activities) {
      // Map Strava activity types to our system
      // Strava types include: Run, Ride, Swim, WeightTraining, Walk, Yoga, Workout, etc.
      const mappedType = activity.type;
      const durationMin = Math.round(activity.moving_time / 60);
      const calories = activity.calories ? Math.round(activity.calories) : 0;

      // Upsert workout
      const workout = await prisma.workout.upsert({
        where: { id: String(activity.id) },
        update: {
          title: activity.name,
          type: mappedType,
          duration: durationMin,
          distance: activity.distance,
          avgHeartRate: activity.average_heartrate ? parseFloat(activity.average_heartrate) : null,
          calories: calories || null,
          relativeEffort: activity.suffer_score ? parseInt(activity.suffer_score, 10) : null,
        },
        create: {
          id: String(activity.id),
          userId,
          date,
          title: activity.name,
          type: mappedType,
          duration: durationMin,
          distance: activity.distance,
          avgHeartRate: activity.average_heartrate ? parseFloat(activity.average_heartrate) : null,
          calories: calories || null,
          relativeEffort: activity.suffer_score ? parseInt(activity.suffer_score, 10) : null,
          source: "strava",
        },
      });

      syncedWorkouts.push(workout);
      addedDuration += durationMin;
      addedCalories += calories;
    }

    // Update DailyLog activeMinutes and caloriesBurned from the synced workouts
    const dailyLog = await prisma.dailyLog.findUnique({
      where: { userId_date: { userId, date } },
    });

    const stepsFromActivities = activities.reduce((sum: number, act: any) => {
      // Estimate steps for walks and runs if not provided (approx 120 steps/minute for run, 100 for walk)
      if (act.type === "Run") return sum + Math.round((act.moving_time / 60) * 150);
      if (act.type === "Walk") return sum + Math.round((act.moving_time / 60) * 110);
      return sum;
    }, 0);

    const log = await prisma.dailyLog.upsert({
      where: { userId_date: { userId, date } },
      update: {
        steps: (dailyLog?.steps ?? 0) + stepsFromActivities,
        activeMinutes: (dailyLog?.activeMinutes ?? 0) + addedDuration,
        caloriesBurned: (dailyLog?.caloriesBurned ?? 0) + addedCalories,
      },
      create: {
        userId,
        date,
        steps: stepsFromActivities,
        activeMinutes: addedDuration,
        caloriesBurned: addedCalories,
      },
    });

    return NextResponse.json({
      success: true,
      source: "strava",
      workoutsSyncedCount: syncedWorkouts.length,
      dailyLog: log,
    });
  } catch (error: any) {
    console.error("Error syncing with Strava:", error);
    return NextResponse.json({ error: "Internal server error during Strava sync" }, { status: 500 });
  }
}
