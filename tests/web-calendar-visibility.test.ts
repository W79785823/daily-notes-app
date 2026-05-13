import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('web calendar visibility', () => {
  it('renders the work calendar on the home page regardless of plain-member mode', () => {
    const page = read('src/app/page.tsx');
    const workCalendarIndex = page.indexOf('<WorkCalendar');
    const plainMemberGuardIndex = page.lastIndexOf('{!isPlainMember &&', workCalendarIndex);

    expect(workCalendarIndex).toBeGreaterThan(-1);
    expect(plainMemberGuardIndex).toBe(-1);
  });

  it('keeps calendar hidden only in the small-screen simplification CSS', () => {
    const formsCss = read('src/app/styles/forms.css');
    expect(formsCss).toContain('@media (max-width: 680px)');
    expect(formsCss).toContain('.calendarCard,\n  .insightCard,\n  .peopleCard,\n  .timelineCard {\n    display: none;\n  }');
  });
});
