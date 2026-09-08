import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BiasWarning,
  CopilotBiasCheckInput,
  CopilotBiasCheckResponse,
  CopilotSuggestActionsInput,
  CopilotSuggestActionsResponse,
  CopilotSynthesizeInput,
  CopilotSynthesizeResponse,
  ResultCode,
  SuggestedAction,
} from '@assessflow/contracts';
import { PrismaService } from '../database/prisma.service';

const BIAS_DICTIONARY: Array<{
  pattern: RegExp;
  category: BiasWarning['category'];
  explanation: string;
  objectiveAlternative: string;
}> = [
  {
    pattern: /\b(bossy|feisty|abrasive|shrill|emotional)\b/i,
    category: 'GENDER_CODED',
    explanation:
      'This term is disproportionately applied to female professionals and evaluates personality rather than observable behaviors.',
    objectiveAlternative: 'Direct in communication; sets firm expectations during team alignment.',
  },
  {
    pattern: /\b(nurturing|sweet|motherly|gentle)\b/i,
    category: 'GENDER_CODED',
    explanation:
      'Interpersonal feedback should focus on mentorship effectiveness and stakeholder collaboration rather than gendered caregiving traits.',
    objectiveAlternative: 'Supportive team mentor; fosters psychological safety and cross-functional rapport.',
  },
  {
    pattern: /\b(young and hungry|lacks energy|too old|old school|seasoned veteran)\b/i,
    category: 'AGE_BIAS',
    explanation:
      'Age-associated or generational generalizations should be replaced with measurable execution velocity and domain experience.',
    objectiveAlternative: 'Demonstrates high initiative / Leverages deep architectural patterns from previous engagements.',
  },
  {
    pattern: /\b(good vibe|bad vibe|gut feeling|doesn't feel like a leader|culture fit)\b/i,
    category: 'SUBJECTIVE_PERSONALITY',
    explanation:
      'Subjective intuition or "vibe" checks introduce confirmation bias. Ground evaluations in explicit competency rubric criteria.',
    objectiveAlternative: 'Meets rubric criteria for cross-functional influence and strategic clarity.',
  },
  {
    pattern: /\b(just gets lucky|someone else probably did it|carried by the team)\b/i,
    category: 'VAGUE_ATTRIBUTION',
    explanation:
      'Dismissive attribution minimizes candidate agency without evidence. Validate candidate individual contributions through commit or spec logs.',
    objectiveAlternative: 'Candidate spearheaded the delivery milestones documented in the technical architecture review.',
  },
];

@Injectable()
export class CopilotService {
  constructor(private readonly prisma: PrismaService) {}

  async synthesize(caseId: string, _input: CopilotSynthesizeInput): Promise<CopilotSynthesizeResponse> {
    let caseData: any = null;

    if (this.prisma.enabled) {
      caseData = await this.prisma.assessmentCase.findUnique({
        where: { id: caseId },
        include: {
          employee: true,
          evidence: true,
          resultRevisions: { orderBy: { revision: 'desc' }, take: 1 },
        },
      });
    }

    const candidateName = caseData?.employee?.displayName ?? 'Candidate';
    const targetRole = caseData?.targetRoleSnapshot ?? 'Target Role';
    const evidenceList = caseData?.evidence ?? [];

    const evidenceSummaries = evidenceList
      .map((e: any) => `${e.summary} Strengths: ${e.strengths ?? 'N/A'}. Gaps: ${e.gaps ?? 'N/A'}`)
      .join(' ');

    const hasStrongDelivery = /deliver|lead|architect|success|master|exceed|scal/i.test(evidenceSummaries);
    const hasCriticalGaps = /gap|miss|fail|lack|risk|behind|inconsistent/i.test(evidenceSummaries);

    let suggestedOutcome: ResultCode = 'READY_WITH_DEVELOPMENT';
    let suggestedOutcomeRationale =
      'Candidate demonstrates capable core execution but shows scoped readiness gaps that warrant a 3 to 6-month structured development milestone.';

    if (hasStrongDelivery && !hasCriticalGaps) {
      suggestedOutcome = 'READY_NOW';
      suggestedOutcomeRationale = `Comprehensive evidence demonstrates that ${candidateName} is consistently performing at or above the competency rubric for ${targetRole}. Immediate transition recommended.`;
    } else if (!hasStrongDelivery && hasCriticalGaps) {
      suggestedOutcome = 'NOT_READY';
      suggestedOutcomeRationale =
        'Assessment evidence indicates multiple blocking competency gaps against the target level. Continued development in current band is recommended prior to reassessment.';
    }

    const executiveSummary =
      evidenceList.length > 0
        ? `Synthesis of ${evidenceList.length} assessor evaluation(s) indicates that ${candidateName} demonstrates strong alignment with ${targetRole} technical requirements, while cross-functional executive presence remains the focal development milestone.`
        : `Initial evaluation synthesis for ${candidateName} indicates verified readiness markers for ${targetRole} based on role baseline and prerequisite tenure. Complete assessor interview evidence to finalize.`;

    return {
      caseId,
      executiveSummary,
      demonstratedStrengths: [
        {
          competency: 'Technical / Domain Mastery',
          evidenceExcerpt:
            'Demonstrated architectural clarity and systematic problem-solving during panel evaluations.',
          confidenceScore: 0.94,
        },
        {
          competency: 'Delivery Execution & Ownership',
          evidenceExcerpt:
            'High accountability for milestones; actively unblocks team dependencies across functions.',
          confidenceScore: 0.89,
        },
      ],
      identifiedGaps: [
        {
          competency: 'Strategic Cross-Functional Influence',
          observation:
            'Requires wider stakeholder buy-in alignment before proposing major cross-team architectural changes.',
          severity: 'MODERATE',
        },
      ],
      suggestedOutcome,
      suggestedOutcomeRationale,
      generatedAt: new Date().toISOString(),
    };
  }

  checkBias(input: CopilotBiasCheckInput): CopilotBiasCheckResponse {
    const warnings: BiasWarning[] = [];
    const text = input.text;

    for (const rule of BIAS_DICTIONARY) {
      const globalPattern = new RegExp(rule.pattern.source, 'gi');
      const matches = Array.from(text.matchAll(globalPattern));
      for (const match of matches) {
        const phrase = match[0];
        if (!warnings.some((w) => w.phrase.toLowerCase() === phrase.toLowerCase())) {
          warnings.push({
            phrase,
            category: rule.category,
            explanation: rule.explanation,
            objectiveAlternative: rule.objectiveAlternative,
          });
        }
      }
    }

    const findingsCount = warnings.length;
    let riskScore: CopilotBiasCheckResponse['riskScore'] = 'LOW';
    if (findingsCount >= 3) riskScore = 'HIGH';
    else if (findingsCount >= 1) riskScore = 'MEDIUM';

    let sanitizedSuggestion = text;
    for (const warning of warnings) {
      const regex = new RegExp(`\\b${warning.phrase}\\b`, 'gi');
      sanitizedSuggestion = sanitizedSuggestion.replace(
        regex,
        `[${warning.objectiveAlternative}]`,
      );
    }

    return {
      clean: findingsCount === 0,
      riskScore,
      findingsCount,
      warnings,
      sanitizedSuggestion: findingsCount > 0 ? sanitizedSuggestion : undefined,
    };
  }

  async suggestActions(
    caseId: string,
    input: CopilotSuggestActionsInput,
  ): Promise<CopilotSuggestActionsResponse> {
    const limit = input.limit ?? 3;

    const actionPool: SuggestedAction[] = [
      {
        title: 'Lead Multi-Department Architectural RFC',
        description:
          'Author and guide an RFC through approval with Product and Security leads to build strategic influence.',
        targetWeeks: 8,
        category: 'PROJECT_DELIVERY',
        suggestedEvidence: 'Signed RFC document and cross-team implementation plan.',
      },
      {
        title: 'Executive Presentation Coaching & Mentorship',
        description:
          'Bi-weekly coaching sessions with a Director-level sponsor focusing on concise executive summaries and risk framing.',
        targetWeeks: 12,
        category: 'MENTORSHIP',
        suggestedEvidence: 'Quarterly review deck presented directly to Department Leadership.',
      },
      {
        title: 'Advanced Systems Design & Scalability Curriculum',
        description:
          'Complete specialized training modules on high-throughput distributed systems and data consistency models.',
        targetWeeks: 6,
        category: 'TRAINING',
        suggestedEvidence: 'Certification of completion and brownbag presentation to team.',
      },
      {
        title: 'Cross-Functional Stakeholder Shadowing',
        description:
          'Spend 2 sprints shadowing Product Operations to better understand operational and commercial trade-offs.',
        targetWeeks: 4,
        category: 'EXPERIENCE',
        suggestedEvidence: 'Operational retrospective memo co-authored with Product Ops lead.',
      },
    ];

    return {
      caseId,
      actions: actionPool.slice(0, limit),
      generatedAt: new Date().toISOString(),
    };
  }
}
