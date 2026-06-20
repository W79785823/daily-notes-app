import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const workflow = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/ci.yml'), 'utf8');

describe('CI 多租户数据库验证', () => {
  it('会启动仓库 docker-compose Postgres 并跑真实数据库验证', () => {
    expect(workflow).toContain('docker compose up -d postgres');
    expect(workflow).toContain('npx prisma db push');
    expect(workflow).toContain('npm run verify:multi-tenant-db');
  });
});
