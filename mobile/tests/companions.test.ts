import { describe, expect, it } from 'vitest';

import { companionStatuses, HealthUnavailableError, healthServiceName, noopSnapshotWriter, unavailableHealthSync } from '../src/domain/integrations/companions';

describe('companion seams', () => {
  it('lists native-only companions per platform without pretending anything is connected', () => {
    const ios = companionStatuses('ios');
    expect(ios.map((s) => s.id)).toEqual(['health', 'widgets', 'watch', 'siri']);
    expect(ios.every((s) => s.availability === 'nativeOnly')).toBe(true);
    const android = companionStatuses('android');
    expect(android.map((s) => s.id)).toEqual(['health', 'widgets']);
    expect(healthServiceName('android')).toBe('Health Connect');
    expect(companionStatuses('ios', { health: true })[0]?.availability).toBe('connected');
  });

  it('refuses health authorization and writes until a bridge exists', async () => {
    const health = unavailableHealthSync('ios');
    expect(health.isAvailable).toBe(false);
    await expect(health.requestAuthorization()).resolves.toBe(false);
    await expect(health.writeWeight(80, new Date())).rejects.toBeInstanceOf(HealthUnavailableError);
    await expect(health.readSteps(new Date())).resolves.toBeUndefined();
    await expect(noopSnapshotWriter.write({ day: '2026-09-16', caloriesEaten: 0, calorieGoal: 2000, protein: 0, carbs: 0, fat: 0, waterMilliliters: 0, waterGoalMilliliters: 2000, accentId: 'fudPink' })).resolves.toBeUndefined();
  });
});
