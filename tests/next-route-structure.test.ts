import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const root = path.join(__dirname, '..');

function dynamicSegmentsAt(directory: string) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name.match(/^\[(.+)\]$/)?.[1])
    .filter(Boolean);
}

describe('Next route structure', () => {
  it('uses a single dynamic segment name under /api/invites', () => {
    expect(new Set(dynamicSegmentsAt('src/app/api/invites'))).toEqual(new Set(['code']));
  });
});
