import { describe, expect, it } from 'vitest';
import { FAILED_ATTEMPTS_BEFORE_LOCK, failedAttemptFields, fmtLockRemaining, lockedRemainingMs, loginSuccessFields, type LoginGuardFields } from '../guard';

describe('login guard', () => {
  it('no lock bajo el umbral de intentos', () => {
    let u: LoginGuardFields = { failedLogins: 0 };
    for (let i = 0; i < FAILED_ATTEMPTS_BEFORE_LOCK - 1; i++) u = failedAttemptFields(u);
    expect(u.failedLogins).toBe(FAILED_ATTEMPTS_BEFORE_LOCK - 1);
    expect(u.lockUntil).toBeUndefined();
    expect(lockedRemainingMs(u)).toBe(0);
  });

  it('al 3.er intento bloquea ~30 s de forma exponencial', () => {
    let u: LoginGuardFields = {};
    for (let i = 0; i < 3; i++) u = failedAttemptFields(u);
    expect(lockedRemainingMs(u)).toBeGreaterThan(0);
    const rest = new Date(u.lockUntil!).getTime() - Date.now();
    expect(rest).toBeGreaterThan(20_000); // >= 30 s (con margen de reloj)
    expect(rest).toBeLessThan(45_000);
  });

  it('escalado exponencial a los siguientes intentos y tope de 1 h', () => {
    let u: LoginGuardFields = {};
    for (let i = 0; i < 50; i++) u = failedAttemptFields(u);
    const rest = new Date(u.lockUntil!).getTime() - Date.now();
    expect(rest).toBeLessThan(3_600_000 + 5_000); // tope 1 h
    expect(rest).toBeGreaterThan(3_500_000);
  });

  it('expira el bloqueo: lockedRemainingMs vuelve a 0', () => {
    const past = { lockUntil: new Date(Date.now() - 1000).toISOString(), failedLogins: 5 };
    expect(lockedRemainingMs(past)).toBe(0);
  });

  it('loginSuccessFields limpia el contador y el bloqueo', () => {
    const u = failedAttemptFields(failedAttemptFields(failedAttemptFields({})));
    expect(loginSuccessFields()).toEqual({ failedLogins: 0, lockUntil: undefined });
    expect(lockedRemainingMs({ ...u, lockUntil: undefined, failedLogins: 0 })).toBe(0);
  });

  it('formato del tiempo restante legible', () => {
    expect(fmtLockRemaining(45_000)).toBe('45 s');
    expect(fmtLockRemaining(120_000)).toBe('2 min');
    expect(fmtLockRemaining(125_000)).toBe('2 min 5 s');
  });
});
