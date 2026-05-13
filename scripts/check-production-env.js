#!/usr/bin/env node
const required = ['DATABASE_URL', 'SESSION_SECRET'];
const missing = required.filter((key) => !process.env[key]);
const errors = [];
if (missing.length) errors.push(`缺少环境变量: ${missing.join(', ')}`);
if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) errors.push('SESSION_SECRET 至少建议 32 位以上随机字符串');
if (process.env.AUTH_ALLOW_DEV_USER_HEADER === 'true') errors.push('生产环境不能开启 AUTH_ALLOW_DEV_USER_HEADER=true');
if (process.env.DATABASE_URL && /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) === false) {
  console.warn('提示: DATABASE_URL 不是 localhost/127.0.0.1，请确认数据库没有直接暴露公网。');
}
if (errors.length) {
  console.error('生产环境检查失败:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('生产环境检查通过');

// PWA checks are handled in tests/pwa.test.ts and Next build.
