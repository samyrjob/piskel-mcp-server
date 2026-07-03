import * as fs from 'fs';
import * as path from 'path';
import { Piskel, PiskelData } from '../core/Piskel.js';
import { Palette } from '../core/Palette.js';

const PROJECTS_DIR = 'projects';
const PALETTES_FILE = 'palettes.json';

export function resolveDataDir(override?: string): string {
  if (override) return override;
  if (process.env.PISKEL_DATA_DIR) return process.env.PISKEL_DATA_DIR;
  return path.join(process.cwd(), '.piskel-mcp');
}

export function ensureDataDir(dataDir: string): void {
  fs.mkdirSync(path.join(dataDir, PROJECTS_DIR), { recursive: true });
}

export function loadAllProjects(dataDir: string): Map<string, Piskel> {
  const projectsDir = path.join(dataDir, PROJECTS_DIR);
  if (!fs.existsSync(projectsDir)) {
    return new Map();
  }

  const projects = new Map<string, Piskel>();
  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const filePath = path.join(projectsDir, file);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw) as PiskelData;
      projects.set(path.basename(file, '.json'), Piskel.fromJSON(data));
    } catch (err) {
      console.error(`[PiskelStore] Failed to load ${file}:`, err);
    }
  }
  return projects;
}

export function saveProject(dataDir: string, projectId: string, piskel: Piskel): void {
  ensureDataDir(dataDir);
  const filePath = path.join(dataDir, PROJECTS_DIR, `${sanitizeId(projectId)}.json`);
  fs.writeFileSync(filePath, JSON.stringify(piskel.toJSON()), 'utf-8');
}

export function deleteProjectFile(dataDir: string, projectId: string): void {
  const filePath = path.join(dataDir, PROJECTS_DIR, `${sanitizeId(projectId)}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function loadPalettes(dataDir: string): Map<string, Palette> {
  const filePath = path.join(dataDir, PALETTES_FILE);
  if (!fs.existsSync(filePath)) {
    return new Map();
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, { name: string; colors: string[] }>;
    const palettes = new Map<string, Palette>();
    for (const [id, p] of Object.entries(data)) {
      palettes.set(id, new Palette(p.name, p.colors));
    }
    return palettes;
  } catch (err) {
    console.error('[PiskelStore] Failed to load palettes:', err);
    return new Map();
  }
}

export function savePalettesToDisk(dataDir: string, palettes: Map<string, Palette>): void {
  ensureDataDir(dataDir);
  const filePath = path.join(dataDir, PALETTES_FILE);
  const data: Record<string, { name: string; colors: string[] }> = {};
  for (const [id, palette] of palettes) {
    data[id] = { name: palette.getName(), colors: palette.getColors() };
  }
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}
