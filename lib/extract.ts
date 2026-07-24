import Anthropic from '@anthropic-ai/sdk';
import { MeetingAnalysis } from './db';

export async function extractMeetingInsights(transcript: string): Promise<MeetingAnalysis> {
  const llamaApiKey = process.env.LLAMA_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  const systemPrompt = `You are a professional meeting intelligence analyst.
Analyze the provided meeting transcript and extract structured intelligence in JSON format.
You must respond with ONLY a valid, parseable JSON object matching this schema:
{
  "summary": "An executive summary of the meeting, high-level overview of key topics and outcomes (2-3 sentences).",
  "keyDiscussionPoints": [
    "First main discussion topic or key point explored during the meeting.",
    "Second main discussion topic or key point explored during the meeting."
  ],
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
  ],
  "nextSteps": [
    "Clear next step or follow-up action planned.",
    "Target milestone or upcoming check-in."
  ]
}

Ensure all JSON keys and values are properly formatted. Do not include any text before or after the JSON.`;

  // 1. Try LlamaCloud Extraction API first if key is present
  if (llamaApiKey && llamaApiKey !== 'YOUR_LLAMA_API_KEY' && llamaApiKey.trim() !== '') {
    try {
      console.log('[Extract Insights] Performing structured extraction using LlamaCloud API...');
      
      // Step A: Fetch project ID dynamically
      let projectId = 'f8c2f134-1828-4029-b3a5-778e2b70f421'; // Default project fallback
      try {
        console.log('[Extract Insights] Fetching LlamaCloud projects...');
        const projRes = await fetch('https://api.cloud.llamaindex.ai/api/v1/projects', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${llamaApiKey}` }
        });
        if (projRes.ok) {
          const projects = await projRes.json();
          if (projects && projects.length > 0) {
            projectId = projects[0].id;
            console.log('[Extract Insights] Found project ID:', projectId);
          }
        }
      } catch (err: any) {
        console.warn('[Extract Insights] Failed to fetch projects list, using default project ID:', err.message);
      }

      // Step B: Upload transcript text file
      console.log('[Extract Insights] Uploading transcript to LlamaCloud...');
      const formData = new FormData();
      const blob = new Blob([transcript], { type: 'text/plain' });
      formData.append('file', blob, 'transcript.txt');
      formData.append('purpose', 'extract');

      const uploadRes = await fetch('https://api.cloud.llamaindex.ai/api/v1/beta/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${llamaApiKey}` },
        body: formData
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status} - ${await uploadRes.text()}`);
      }

      const uploadData = await uploadRes.json();
      const fileId = uploadData.id;
      console.log('[Extract Insights] File uploaded successfully. File ID:', fileId);

      // Wait a short moment to ensure registration on LlamaCloud
      await new Promise(r => setTimeout(r, 1000));

      // Step C: Trigger structured data extraction job
      console.log('[Extract Insights] Submitting extraction job...');
      const extractBody = {
        file_input: fileId,
        configuration: {
          tier: 'agentic',
          version: '2026-03-31',
          extraction_target: 'per_doc',
          data_schema: {
            type: 'object',
            properties: {
              summary: {
                type: 'string',
                description: 'An executive summary of the meeting, high-level overview of key topics and outcomes (2-3 sentences).'
              },
              decisions: {
                type: 'array',
                description: 'List of decisions reached in the meeting.',
                items: {
                  type: 'object',
                  properties: {
                    decision: { type: 'string', description: 'The decision made.' },
                    decider: { type: 'string', description: 'Who made the decision.' },
                    context: { type: 'string', description: 'Context or reasoning behind the decision.' }
                  },
                  required: ['decision', 'decider', 'context']
                }
              },
              actionItems: {
                type: 'array',
                description: 'List of action items or tasks assigned to people.',
                items: {
                  type: 'object',
                  properties: {
                    task: { type: 'string', description: 'The specific task description.' },
                    assignee: { type: 'string', description: 'Who is responsible for the task.' },
                    dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format (estimate if not explicitly stated).' }
                  },
                  required: ['task', 'assignee', 'dueDate']
                }
              },
              risks: {
                type: 'array',
                description: 'List of risks or warnings discussed.',
                items: {
                  type: 'object',
                  properties: {
                    risk: { type: 'string', description: 'Description of the risk identified.' },
                    impact: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Impact level of the risk.' },
                    mitigation: { type: 'string', description: 'How the risk will be mitigated or resolved.' }
                  },
                  required: ['risk', 'impact', 'mitigation']
                }
              },
              notes: {
                type: 'array',
                description: 'List of important key notes, warnings, guidelines, or deadlines mentioned.',
                items: { type: 'string' }
              }
            },
            required: ['summary', 'decisions', 'actionItems', 'risks', 'notes']
          }
        }
      };

      const extractRes = await fetch(`https://api.cloud.llamaindex.ai/api/v2/extract?project_id=${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llamaApiKey}`
        },
        body: JSON.stringify(extractBody)
      });

      if (!extractRes.ok) {
        throw new Error(`Job submission failed: ${extractRes.status} - ${await extractRes.text()}`);
      }

      const extractJob = await extractRes.json();
      const jobId = extractJob.id;
      console.log('[Extract Insights] Job submitted successfully. Job ID:', jobId);

      // Step D: Poll for extraction results
      let attempts = 0;
      let extractResult: any = null;

      while (attempts < 15) {
        await new Promise(r => setTimeout(r, 2000));
        console.log(`[Extract Insights] Polling LlamaCloud job status (attempt ${attempts + 1})...`);
        
        const statusRes = await fetch(`https://api.cloud.llamaindex.ai/api/v2/extract/${jobId}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${llamaApiKey}` }
        });

        if (!statusRes.ok) {
          throw new Error(`Job status check failed: ${statusRes.status} - ${await statusRes.text()}`);
        }

        const statusData = await statusRes.json();
        const status = statusData.status?.toUpperCase();

        if (status === 'COMPLETED' || status === 'SUCCESS') {
          extractResult = statusData.extract_result;
          console.log('[Extract Insights] Structured extraction completed successfully!');
          break;
        } else if (status === 'FAILED') {
          throw new Error(`LlamaCloud extraction job failed on server side: ${statusData.error_message}`);
        }
        attempts++;
      }

      if (extractResult) {
        const parsed: MeetingAnalysis = {
          summary: extractResult.summary || 'Summary not available.',
          decisions: (extractResult.decisions || []).map((d: any, idx: number) => ({
            id: d.id || `dec-${idx + 1}`,
            decision: d.decision,
            decider: d.decider || 'Team',
            context: d.context || 'Aligned on during sync.'
          })),
          actionItems: (extractResult.actionItems || []).map((a: any, idx: number) => ({
            id: a.id || `act-${idx + 1}`,
            task: a.task,
            assignee: a.assignee || 'Unassigned',
            dueDate: a.dueDate || new Date(Date.now() + 7*24*3600*1000).toISOString().split('T')[0],
            status: a.status || 'pending'
          })),
          risks: (extractResult.risks || []).map((r: any, idx: number) => ({
            id: r.id || `risk-${idx + 1}`,
            risk: r.risk,
            impact: r.impact || 'medium',
            mitigation: r.mitigation || 'Monitor closely.'
          })),
          notes: extractResult.notes || []
        };
        return parsed;
      }
    } catch (err: any) {
      console.error('[Extract Insights] LlamaCloud extraction pipeline failed:', err.message);
    }
  }

  // 2. Fallback to Anthropic if LlamaCloud failed/was missing, and Anthropic key is present
  if (anthropicApiKey && anthropicApiKey !== 'YOUR_ANTHROPIC_API_KEY' && anthropicApiKey.trim() !== '') {
    try {
      console.log('[Extract Insights] Falling back to Anthropic (Claude)...');
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Here is the meeting transcript:\n\n${transcript}` }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      
      // Parse the JSON reliably, stripping markdown wrapper if returned
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

      const startIdx = cleanJsonText.indexOf('{');
      const endIdx = cleanJsonText.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        cleanJsonText = cleanJsonText.substring(startIdx, endIdx + 1);
      }

      const parsed: MeetingAnalysis = JSON.parse(cleanJsonText);
      
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
 
      if (parsed.notes) {
        parsed.notes = parsed.notes.map(n => typeof n === 'string' ? n : JSON.stringify(n));
      } else {
        parsed.notes = [];
      }
 
      return parsed;
    } catch (err) {
      console.error('[Extract Insights] Anthropic fallback failed:', err);
    }
  }

  // 3. Fallback to local heuristic parser if both failed/are missing
  console.log('[Extract Insights] No active API key or all APIs failed. Using local heuristic parser fallback...');
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return localHeuristicParser(transcript);
}

function localHeuristicParser(transcript: string): MeetingAnalysis {

  // -------------------------------------------------------------
  // DYNAMIC HEURISTIC PARSING FOR TRANSCRIPT CONTENT
  // -------------------------------------------------------------
  const lines = transcript
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const cleanLine = (text: string) => {
    return text.replace(/^\[\d{2}:\d{2}\]\s*[^:]+:\s*/i, '').trim();
  };

  const sentences: string[] = [];
  const lineDetails: { speaker: string; text: string }[] = [];

  lines.forEach(line => {
    const speakerMatch = line.match(/^\[\d{2}:\d{2}\]\s*([^:]+):\s*(.*)/i);
    let speaker = 'Participant';
    let text = line;
    if (speakerMatch) {
      speaker = speakerMatch[1].trim();
      text = speakerMatch[2].trim();
    } else {
      text = cleanLine(line);
    }
    lineDetails.push({ speaker, text });

    const matches = text.match(/[^.!?]+[.!?]+/g) || [text];
    matches.forEach(s => {
      const trimmed = s.trim();
      if (trimmed.length > 4) {
        sentences.push(trimmed);
      }
    });
  });

  if (sentences.length === 0) {
    sentences.push(transcript.slice(0, 100));
  }

  // Executive Summary (first 3 sentences)
  const firstThree = sentences.slice(0, 3).join(' ');
  const summary = firstThree.length > 20 ? firstThree : "Discussion overview and alignment on project deliverables based on the meeting transcript.";

  // Key Discussion Points (extending top themes)
  const keyDiscussionPoints: string[] = [];
  sentences.forEach((s, idx) => {
    if (idx % 2 === 0 && keyDiscussionPoints.length < 5 && s.length > 15) {
      keyDiscussionPoints.push(s);
    }
  });
  if (keyDiscussionPoints.length === 0) {
    keyDiscussionPoints.push("Key themes and topics explored during the meeting sync.");
  }

  // Decisions
  const decisions: { id: string; decision: string; decider: string; context: string }[] = [];
  const decisionKeywords = ['decid', 'agree', 'choose', 'select', 'favor', 'prefer', 'standard', 'policy', 'favorite', 'like'];
  
  lines.forEach((line, idx) => {
    const textClean = cleanLine(line);
    const hasKeyword = decisionKeywords.some(kw => textClean.toLowerCase().includes(kw));
    if (hasKeyword && decisions.length < 5) {
      const detail = lineDetails[idx];
      decisions.push({
        id: `dec-local-${decisions.length + 1}`,
        decision: textClean,
        decider: detail.speaker,
        context: `Agreed upon during the live conversation.`
      });
    }
  });

  if (decisions.length === 0) {
    decisions.push({
      id: "dec-local-1",
      decision: sentences[Math.floor(sentences.length / 2)] || "General discussion alignment",
      decider: lineDetails[0]?.speaker || "Team",
      context: "Derived from discussion topics."
    });
  }

  // Action Items
  const actionItems: { id: string; task: string; assignee: string; dueDate: string; status: 'pending' | 'completed' }[] = [];
  const actionKeywords = ['will', 'need to', 'should', 'must', 'action', 'task', 'todo', 'assign', 'schedule', 'own', 'work on', 'follow up', 'implement'];
  
  lines.forEach((line, idx) => {
    const textClean = cleanLine(line);
    const hasKeyword = actionKeywords.some(kw => textClean.toLowerCase().includes(kw));
    if (hasKeyword && actionItems.length < 6) {
      const detail = lineDetails[idx];
      actionItems.push({
        id: `act-local-${actionItems.length + 1}`,
        task: textClean,
        assignee: detail.speaker,
        dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
        status: 'pending'
      });
    }
  });

  if (actionItems.length === 0) {
    actionItems.push({
      id: "act-local-1",
      task: sentences[Math.min(1, sentences.length - 1)] || "Review sync notes",
      assignee: lineDetails[0]?.speaker || "All",
      dueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0],
      status: 'pending'
    });
  }

  // Risks
  const risks: { id: string; risk: string; impact: 'low' | 'medium' | 'high'; mitigation: string }[] = [];
  const riskKeywords = ['risk', 'issue', 'problem', 'fail', 'delay', 'danger', 'concern', 'worry', 'threat', 'lag', 'vulnerability', 'bottleneck'];
  
  lines.forEach((line, idx) => {
    const textClean = cleanLine(line);
    const hasKeyword = riskKeywords.some(kw => textClean.toLowerCase().includes(kw));
    if (hasKeyword && risks.length < 5) {
      const impact: 'low' | 'medium' | 'high' = textClean.toLowerCase().includes('high') || textClean.toLowerCase().includes('severe') ? 'high' : 'medium';
      risks.push({
        id: `risk-local-${risks.length + 1}`,
        risk: textClean,
        impact,
        mitigation: `Monitor this topic closely and implement preventative checks.`
      });
    }
  });

  if (risks.length === 0) {
    risks.push({
      id: "risk-local-1",
      risk: sentences[sentences.length - 1] || "Unstructured discussion items",
      impact: "medium",
      mitigation: "Document detailed criteria to clarify intent."
    });
  }

  // Next Steps
  const nextSteps: string[] = [];
  actionItems.forEach(item => {
    nextSteps.push(`${item.assignee} to complete "${item.task}" by ${item.dueDate}.`);
  });
  if (nextSteps.length === 0) {
    nextSteps.push("Follow up on identified meeting milestones in the next team sync.");
  }

  return {
    summary,
    keyDiscussionPoints,
    decisions,
    actionItems,
    risks,
    nextSteps
  };
}
