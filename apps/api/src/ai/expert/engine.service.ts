import { Injectable } from '@nestjs/common';
import type { FiredRule, PostSignals } from '@social-manager/types';
import { evaluateRules } from './rules.js';

@Injectable()
export class ExpertEngineService {
  run(signals: PostSignals): FiredRule[] {
    const fired = evaluateRules(signals);

    const r001Fired = fired.some((r) => r.ruleId === 'R001');
    const r003Fired = fired.some((r) => r.ruleId === 'R003');

    if (r001Fired && r003Fired) {
      fired.push({
        ruleId: 'R006',
        condition:
          'R001 (UNDERPERFORMING) AND R003 (VIRAL_BUT_HOLLOW) both fired',
        conclusion: 'CRITICAL_INTERVENTION_NEEDED',
        confidence: 0.95,
        action:
          'Immediate content strategy overhaul required — viral reach not converting',
      });
    }

    return fired;
  }
}
