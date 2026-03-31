import { NextRequest, NextResponse } from "next/server";
import {
  loadProjects,
  createProject,
  deleteProject,
} from "@/lib/projects";

export async function GET() {
  try {
    const projects = loadProjects();
    return NextResponse.json({ success: true, data: projects });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, description } = await req.json() as { name: string; description: string };
    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: "プロジェクト名は必須です" },
        { status: 400 }
      );
    }
    const project = createProject(name.trim(), description?.trim() ?? "");
    return NextResponse.json({ success: true, data: project }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 }
      );
    }
    deleteProject(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
