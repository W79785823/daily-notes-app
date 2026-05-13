import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { allowDevUserHeader, createSessionToken, isSessionFreshForUser, verifySessionToken } from '../src/lib/session';

const TEST_SESSION_SECRET = 'test-session-secret-for-vitest';

function withEnv<T>(key: string, value: string | undefined, run: () => T) {
  const old = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    return run();
  } finally {
    if (old === undefined) delete process.env[key];
    else process.env[key] = old;
  }
}

describe('会话令牌', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = TEST_SESSION_SECRET;
  });

  afterEach(() => {
    delete process.env.SESSION_SECRET;
  });
  it('可以创建并校验用户会话 token', () => {
    const token = createSessionToken('u-1', 0, 1000);

    expect(verifySessionToken(token, 1000)?.userId).toBe('u-1');
  });

  it('会拒绝被篡改的 token', () => {
    const token = createSessionToken('u-1', 0, 1000);
    const [, signature] = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ userId: 'u-2', exp: 605800 })).toString('base64url');
    const tampered = `${tamperedPayload}.${signature}`;

    expect(verifySessionToken(tampered, 1000)).toBeNull();
  });

  it('会拒绝过期 token', () => {
    const token = createSessionToken('u-1', 0, 1000);

    expect(verifySessionToken(token, 1000 + 60 * 60 * 24 * 8)).toBeNull();
  });

  it('用户会话版本更新后会拒绝旧 token', () => {
    const token = createSessionToken('u-1', 7, 1000);
    const session = verifySessionToken(token, 1001);

    expect(session).not.toBeNull();
    expect(isSessionFreshForUser(session!, 7)).toBe(true);
    expect(isSessionFreshForUser(session!, 8)).toBe(false);
  });

  it('可以通过环境变量关闭开发用户头兼容', () => {
    expect(withEnv('AUTH_ALLOW_DEV_USER_HEADER', 'false', allowDevUserHeader)).toBe(false);
    expect(withEnv('AUTH_ALLOW_DEV_USER_HEADER', 'true', allowDevUserHeader)).toBe(true);
  });
});
