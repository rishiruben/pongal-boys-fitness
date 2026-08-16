import { NextResponse } from "next/server";
import prisma from "@/lib/db";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, props: Props) {
  try {
    const { id } = await props.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        dailyScores: {
          orderBy: { date: "desc" },
          take: 10,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error: any) {
    console.error("Error fetching user detail:", error);
    return NextResponse.json({ error: "Failed to fetch user details" }, { status: 500 });
  }
}

export async function PUT(request: Request, props: Props) {
  try {
    const { id } = await props.params;
    const body = await request.json();
    const { name, targetCalories, targetActiveMinutes, targetSteps } = body;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name: name ?? user.name,
        targetCalories: targetCalories !== undefined ? parseInt(targetCalories, 10) : user.targetCalories,
        targetActiveMinutes: targetActiveMinutes !== undefined ? parseInt(targetActiveMinutes, 10) : user.targetActiveMinutes,
        targetSteps: targetSteps !== undefined ? parseInt(targetSteps, 10) : user.targetSteps,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
