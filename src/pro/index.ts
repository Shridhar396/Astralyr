/**
 * Astralyr Pro Entry Point
 * Resolved to @pro-engine via Vite alias:
 * - In web builds: points to src/pro/stubs.ts (0 Pro code)
 * - In desktop builds: points to src/pro/proModules.ts (Full Pro engine)
 */

export * from './types';
// @ts-ignore - aliased by Vite build configuration
export { proEngineInstance } from '@pro-engine';
