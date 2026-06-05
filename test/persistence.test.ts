import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Piskel } from '../src/core/Piskel.js';
import { Layer } from '../src/core/Layer.js';
import { Frame } from '../src/core/Frame.js';
import { Palette } from '../src/core/Palette.js';
import { colorToInt } from '../src/core/color.js';
import {
  resolveDataDir,
  ensureDataDir,
  loadAllProjects,
  saveProject,
  deleteProjectFile,
  loadPalettes,
  savePalettesToDisk,
} from '../src/server/PiskelStore.js';

const TEST_DATA_DIR = path.join(process.cwd(), 'test', '.piskel-mcp-test');

describe('Persistence', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true });
    }
  });

  it('resolveDataDir defaults to cwd + .piskel-mcp', () => {
    const dir = resolveDataDir();
    expect(dir).toBe(path.join(process.cwd(), '.piskel-mcp'));
  });

  it('resolveDataDir uses env override', () => {
    process.env.PISKEL_DATA_DIR = '/custom/path';
    const dir = resolveDataDir();
    expect(dir).toBe('/custom/path');
    delete process.env.PISKEL_DATA_DIR;
  });

  it('resolveDataDir uses explicit override', () => {
    const dir = resolveDataDir('/explicit/path');
    expect(dir).toBe('/explicit/path');
  });

  it('should save and reload a project', () => {
    const piskel = new Piskel(32, 32, 12, { name: 'Test Project' });
    const layer = new Layer('Layer 1');
    const frame = new Frame(32, 32);
    frame.setPixel(5, 10, '#FF0000');
    frame.setPixel(15, 20, '#00FF00');
    layer.addFrame(frame);
    piskel.addLayer(layer);

    saveProject(TEST_DATA_DIR, 'test-proj', piskel);

    const projects = loadAllProjects(TEST_DATA_DIR);
    expect(projects.has('test-proj')).toBe(true);

    const loaded = projects.get('test-proj')!;
    expect(loaded.getName()).toBe('Test Project');
    expect(loaded.getWidth()).toBe(32);
    expect(loaded.getHeight()).toBe(32);
    expect(loaded.getFPS()).toBe(12);
    expect(loaded.getLayerCount()).toBe(1);

    const loadedFrame = loaded.getFrame(0, 0)!;
    expect(loadedFrame.getPixel(5, 10)).toBe(colorToInt('#FF0000'));
    expect(loadedFrame.getPixel(15, 20)).toBe(colorToInt('#00FF00'));
  });

  it('should round-trip multiple layers and frames', () => {
    const piskel = new Piskel(16, 16, 6, { name: 'Multi-layer' });

    const layer1 = new Layer('Foreground');
    const f1 = new Frame(16, 16);
    f1.setPixel(0, 0, '#FFFFFF');
    f1.setPixel(15, 15, '#000000');
    layer1.addFrame(f1);
    piskel.addLayer(layer1);

    const layer2 = new Layer('Background');
    layer2.setOpacity(0.5);
    layer2.setVisible(false);
    const f2 = new Frame(16, 16);
    f2.setPixel(7, 7, '#FF0000');
    layer2.addFrame(f2);
    piskel.addLayer(layer2);

    saveProject(TEST_DATA_DIR, 'multi', piskel);
    const projects = loadAllProjects(TEST_DATA_DIR);
    const loaded = projects.get('multi')!;

    expect(loaded.getLayerCount()).toBe(2);
    expect(loaded.getLayerAt(0)!.getName()).toBe('Foreground');
    expect(loaded.getLayerAt(1)!.getName()).toBe('Background');
    expect(loaded.getFrame(0, 0)!.getPixel(0, 0)).toBe(0xFFFFFFFF);
    expect(loaded.getFrame(1, 0)!.getPixel(7, 7)).toBe(0xFF0000FF);

    const bgLayer = loaded.getLayerAt(1)!;
    expect(bgLayer.getOpacity()).toBe(0.5);
    expect(bgLayer.isVisible()).toBe(false);
  });

  it('should delete project file', () => {
    const piskel = new Piskel(8, 8, 1, { name: 'Delete me' });
    piskel.addLayer(new Layer('L1'));
    piskel.getLayerAt(0)!.addFrame(new Frame(8, 8));
    saveProject(TEST_DATA_DIR, 'to-delete', piskel);

    expect(loadAllProjects(TEST_DATA_DIR).has('to-delete')).toBe(true);

    deleteProjectFile(TEST_DATA_DIR, 'to-delete');
    expect(loadAllProjects(TEST_DATA_DIR).has('to-delete')).toBe(false);
  });

  it('should handle empty data directory gracefully', () => {
    const projects = loadAllProjects(TEST_DATA_DIR);
    expect(projects.size).toBe(0);

    const palettes = loadPalettes(TEST_DATA_DIR);
    expect(palettes.size).toBe(0);
  });

  it('should save and load palettes', () => {
    const palettes = new Map<string, Palette>();
    palettes.set('my-palette', new Palette('My Colors', ['#FF0000', '#00FF00']));
    palettes.set('empty-palette', new Palette('Empty'));

    savePalettesToDisk(TEST_DATA_DIR, palettes);

    const loaded = loadPalettes(TEST_DATA_DIR);
    expect(loaded.size).toBe(2);
    expect(loaded.get('my-palette')!.getColors()).toEqual(['#FF0000', '#00FF00']);
    expect(loaded.get('empty-palette')!.getColors()).toEqual([]);
  });

  it('should handle missing palette file gracefully', () => {
    const palettes = loadPalettes(TEST_DATA_DIR);
    expect(palettes.size).toBe(0);
  });

  it('should handle corrupted project file gracefully', () => {
    ensureDataDir(TEST_DATA_DIR);
    fs.writeFileSync(
      path.join(TEST_DATA_DIR, 'projects', 'corrupt.json'),
      'not valid json',
      'utf-8'
    );

    const projects = loadAllProjects(TEST_DATA_DIR);
    expect(projects.size).toBe(0);
  });

  it('should persist PiskelDescriptor description field', () => {
    const piskel = new Piskel(16, 16, 1, { name: 'HasDesc', description: 'A test sprite' });
    piskel.addLayer(new Layer('L1'));
    piskel.getLayerAt(0)!.addFrame(new Frame(16, 16));

    saveProject(TEST_DATA_DIR, 'desc-test', piskel);
    const loaded = loadAllProjects(TEST_DATA_DIR).get('desc-test')!;
    expect(loaded.getDescriptor().description).toBe('A test sprite');
  });
});
