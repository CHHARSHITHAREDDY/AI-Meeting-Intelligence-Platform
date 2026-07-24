import Anthropic from '@anthropic-ai/sdk';
import { MeetingAnalysis } from './db';

export async function extractMeetingInsights(transcript: string): Promise<MeetingAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey === 'YOUR_ANTHROPIC_API_KEY' || apiKey.trim() === '') {
    console.log('Anthropic API key missing or default. Running Claude in Mock Mode...');
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Dynamic mock fallback based on transcript contents
    if (transcript.includes('CPU usage') || transcript.includes('read-replica')) {
      return {
        summary: "The team aligned on the Q4 infrastructure scaling roadmap. Key database performance issues were discussed, resulting in a decision to implement a read-replica for reporting queries to alleviate CPU peaks. In addition, a security audit is underway to review IAM roles and transition to short-lived session tokens. Read-replica sync lag was identified as a key risk.",
        decisions: [
          {
            id: "dec-mock-1",
            decision: "Set up a read-replica for reporting database queries by October 15th.",
            decider: "Sarah (Product Manager) & Alex (Engineering Lead)",
            context: "Database CPU peaks at 90% during peak hours due to heavy read queries on the analytics table."
          },
          {
            id: "dec-mock-2",
            decision: "Implement short-lived session tokens as the new standard security policy.",
            decider: "Sarah (Product Manager) & Michael (Security Specialist)",
            context: "Mitigates credential leakage risks and enhances session security."
          }
        ],
        actionItems: [
          {
            id: "act-mock-1",
            task: "Implement database replication and offload reporting queries to read-replica.",
            assignee: "Alex (Engineering Lead)",
            dueDate: "2026-10-15",
            status: "pending"
          },
          {
            id: "act-mock-2",
            task: "Finish auditing IAM roles and clean up unused access tokens.",
            assignee: "Michael (Security Specialist)",
            dueDate: "2026-10-02",
            status: "pending"
          },
          {
            id: "act-mock-3",
            task: "Document the migration plan for short-lived session tokens.",
            assignee: "Michael (Security Specialist)",
            dueDate: "2026-10-10",
            status: "pending"
          },
          {
            id: "act-mock-4",
            task: "Alert frontend team and ensure UI handles eventual consistency of read-replica.",
            assignee: "Sarah (Product Manager)",
            dueDate: "2026-10-05",
            status: "pending"
          }
        ],
        risks: [
          {
            id: "risk-mock-1",
            risk: "Read-replica sync lag of 2-3 seconds causing data consistency issues in the UI.",
            impact: "medium",
            mitigation: "Ensure frontend components implement loading cues or optimistic updates to handle eventual consistency."
          },
          {
            id: "risk-mock-2",
            risk: "Potential database downtime during replication setup.",
            impact: "high",
            mitigation: "Schedule the migration window during low-traffic periods (Sunday 2 AM) with automated rollbacks."
          }
        ]
      };
    }

    // Default mock response for other uploaded files
    return {
      summary: "The meeting covered project progress and next key milestones. The team aligned on timelines, delegated action items, and analyzed active risks surrounding integration dependencies.",
      decisions: [
        {
          id: "dec-gen-1",
          decision: "Adopt the proposed feature scope and timeline changes.",
          decider: "Project Lead",
          context: "Adjusting timeline due to minor upstream module dependency delays."
        }
      ],
      actionItems: [
        {
          id: "act-gen-1",
          task: "Complete API endpoint documentation and share with frontend partners.",
          assignee: "Lead Developer",
          dueDate: "2026-07-30",
          status: "pending"
        },
        {
          id: "act-gen-2",
          task: "Schedule user acceptance testing session for key stakeholders.",
          assignee: "Product Manager",
          dueDate: "2026-08-04",
          status: "pending"
        }
      ],
      risks: [
        {
          id: "risk-gen-1",
          risk: "API integration delays due to third-party sandbox stability.",
          impact: "medium",
          mitigation: "Create offline mock services to unblock front-end developer workflow."
        }
      ]
    };
  }

  const anthropic = new Anthropic({ apiKey });

  const systemPrompt = `You are a professional meeting intelligence analyst.
Analyze the provided meeting transcript and extract structured intelligence in JSON format.
You must respond with ONLY a valid, parseable JSON object matching this schema:
{
  "summary": "An executive summary of the meeting, high-level overview of key topics and outcomes (2-3 sentences).",
  "decisions": [
    {
      "id": "dec-1",
      "decision": "The decision made.",
      "decider": "Who made the decision.",
      "context": "Context or reasoning behind the decision."
    }
  ],
  "actionItems": [
    {
      "id": "act-1",
      "task": "The specific task description.",
      "assignee": "Who is responsible for the task.",
      "dueDate": "YYYY-MM-DD format (estimate if not explicitly stated, base on current date context 2026-07-24).",
      "status": "pending"
    }
  ],
  "risks": [
    {
      "id": "risk-1",
      "risk": "Description of the risk identified.",
      "impact": "low" | "medium" | "high",
      "mitigation": "How the risk will be mitigated or resolved."
    }
  ]
}

Ensure all JSON keys and values are properly formatted. Do not include any text before or after the JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Here is the meeting transcript:\n\n${transcript}` }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    
    // Parse the JSON reliably, stripping markdown wrapper if Claude returned it
    let cleanJsonText = text.trim();
    if (cleanJsonText.startsWith('```json')) {
      cleanJsonText = cleanJsonText.slice(7);
    } else if (cleanJsonText.startsWith('```')) {
      cleanJsonText = cleanJsonText.slice(3);
    }
    if (cleanJsonText.endsWith('```')) {
      cleanJsonText = cleanJsonText.slice(0, -3);
    }
    cleanJsonText = cleanJsonText.trim();

    // Secondary cleanup: extract content between first { and last }
    const startIdx = cleanJsonText.indexOf('{');
    const endIdx = cleanJsonText.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) {
      cleanJsonText = cleanJsonText.substring(startIdx, endIdx + 1);
    }

    const parsed: MeetingAnalysis = JSON.parse(cleanJsonText);
    
    // Ensure ids are present and unique
    if (parsed.decisions) {
      parsed.decisions = parsed.decisions.map((d, i) => ({ ...d, id: d.id || `dec-${i + 1}` }));
    } else {
      parsed.decisions = [];
    }
    
    if (parsed.actionItems) {
      parsed.actionItems = parsed.actionItems.map((a, i) => ({ ...a, id: a.id || `act-${i + 1}`, status: a.status || 'pending' }));
    } else {
      parsed.actionItems = [];
    }

    if (parsed.risks) {
      parsed.risks = parsed.risks.map((r, i) => ({ ...r, id: r.id || `risk-${i + 1}` }));
    } else {
      parsed.risks = [];
    }

    return parsed;
  } catch (error) {
    console.error('Claude API or Parsing Error:', error);
    throw error;
  }
}
