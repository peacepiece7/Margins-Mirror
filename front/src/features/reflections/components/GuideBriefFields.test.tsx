import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { GuideBriefInput } from '@/types/api/reflection-loop';

import { GuideBriefFields } from './GuideBriefFields';

const initial: GuideBriefInput = {
  purpose: 'THOUGHT_EXPANSION',
  audienceMode: 'SELF_AI',
  targetMinutes: 40,
  disclosureMode: 'PRIVATE_CONTEXT',
  facilitationLevel: 'BEGINNER',
};

function BriefHarness() {
  const [brief, setBrief] = useState(initial);
  return (
    <>
      <GuideBriefFields onChange={setBrief} value={brief} />
      <output>
        {brief.purpose}/{brief.audienceMode}/{brief.targetMinutes}/{brief.disclosureMode}
      </output>
    </>
  );
}

describe('GuideBriefFields', () => {
  afterEach(cleanup);

  it('updates every approved GuideBrief choice through accessible radio controls', () => {
    render(<BriefHarness />);

    fireEvent.click(screen.getByText('고급 설정'));
    fireEvent.click(screen.getByLabelText(/쟁점 탐색/));
    fireEvent.click(screen.getByLabelText(/소그룹/));
    fireEvent.click(screen.getByLabelText('60분'));
    fireEvent.click(screen.getByLabelText(/비공개 답변 제외/));

    expect(screen.getByText('ISSUE_EXPLORATION/SMALL_GROUP/60/REFLECTION_ONLY')).toBeVisible();
    expect(screen.getByLabelText(/비공개 답변 제외/)).toBeChecked();
  });
});
