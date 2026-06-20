import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const root = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('多租户地基', () => {
  it('Prisma schema 定义 Team、Invite 和租户字段', () => {
    const schema = read('prisma/schema.prisma');

    expect(schema).toContain('model Team');
    expect(schema).toContain('model Invite');
    expect(schema).toMatch(/teamId\s+String\?/);
    expect(schema).toContain('isSuperAdmin Boolean  @default(false)');
    expect(schema).toContain('@@unique([teamId, name])');
    expect(schema).toMatch(/teamId\s+String/);
    expect(schema).toContain('team Team @relation(fields: [teamId], references: [id]');
  });

  it('手写迁移会回填默认团队并建立租户索引和外键', () => {
    const migration = read('prisma/migrations/20260618090000_multi_tenant/migration.sql');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "Team"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "Invite"');
    expect(migration).toContain('默认团队');
    expect(migration).toContain('ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_name_key"');
    expect(migration).toContain('DROP INDEX IF EXISTS "User_name_key"');
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "User_teamId_name_key"');
    expect(migration).toContain('ALTER TABLE "Task" ALTER COLUMN "teamId" SET NOT NULL');
    expect(migration).toContain('EXCEPTION WHEN duplicate_object THEN NULL');
  });

  it('提供超管 bootstrap 脚本和环境变量说明', () => {
    const pkg = read('package.json');
    const env = read('.env.example');
    const script = read('scripts/bootstrap-super-admin.js');

    expect(pkg).toContain('"bootstrap:superadmin"');
    expect(env).toContain('SUPER_ADMIN_LOGIN');
    expect(env).toContain('SUPER_ADMIN_PASSWORD');
    expect(script).toContain('isSuperAdmin: true');
    expect(script).toContain('teamId: null');
    expect(script).toContain('scrypt:');
  });
});
