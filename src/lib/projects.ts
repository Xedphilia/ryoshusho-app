import fs from "fs";
import path from "path";
import { Project, AgentSession } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PROJECTS_FILE)) fs.writeFileSync(PROJECTS_FILE, "[]");
}

export function loadProjects(): Project[] {
  ensureDataDir();
  const raw = fs.readFileSync(PROJECTS_FILE, "utf-8");
  return JSON.parse(raw) as Project[];
}

export function saveProjects(projects: Project[]) {
  ensureDataDir();
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

export function getProject(id: string): Project | undefined {
  return loadProjects().find((p) => p.id === id);
}

export function createProject(name: string, description: string): Project {
  const projects = loadProjects();
  const sessions: AgentSession[] = [0, 1, 2, 3, 4, 5, 6].map((agentId) => ({
    agentId: agentId as AgentSession["agentId"],
    messages: [],
    completed: false,
  }));

  const project: Project = {
    id: `proj_${Date.now()}`,
    name,
    description,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    currentAgent: 1,
    sessions,
  };

  saveProjects([...projects, project]);
  return project;
}

export function updateProject(id: string, updates: Partial<Project>): Project {
  const projects = loadProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error(`Project ${id} not found`);
  const updated = { ...projects[idx], ...updates, updatedAt: Date.now() };
  projects[idx] = updated;
  saveProjects(projects);
  return updated;
}

export function deleteProject(id: string) {
  const projects = loadProjects().filter((p) => p.id !== id);
  saveProjects(projects);
}
