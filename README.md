# 🚀 AI Meeting Intelligence Platform | Enterprise B2B SaaS

> **Transforming raw meeting recordings into structured business intelligence, automated action items, and conversational RAG analytics — built with minimal infrastructure unit cost and maximum profit margins (~90% Gross Margin).**

---

## 💡 Executive Summary & Startup Pitch

Meetings account for **over 35% of an executive's work week**, leading to an estimated **$37 Billion in lost productivity annually** due to uncaptured decisions, missed action items, and manual note-taking.

**AI Meeting Intelligence Platform** is an enterprise-ready, 3-panel SaaS application that automates the entire post-meeting workflow. Users simply upload any meeting recording (`.mp4`, `.mov`, `.m4a`, `.mp3`, `.wav`), and our multi-stage pipeline ingests, transcribes, analyzes, indexes, and surfaces grounded conversational insights in seconds.

---

## 📈 Business Model & Unit Economics (Minimal Cost $\rightarrow$ Maximum Profit)

Designed specifically for **high SaaS profit margins** and **low operational overhead**:

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                           SaaS UNIT ECONOMICS                               │
 ├───────────────────────────────┬─────────────────────────────────────────────┤
 │ Compute & Storage Cost        │ ~$0.015 per 30-minute meeting               │
 │ Proposed Pro Subscription     │ $29 / user / month                          │
 │ Proposed Enterprise Tier      │ $199 / team seat / month                    │
 │ Estimated Gross Margin        │ 88% - 92%                                   │
 └───────────────────────────────┴─────────────────────────────────────────────┘
```

### Why Infrastructure Costs Stay Low:
1. **Serverless Database Architecture:** Powered by **Neon PostgreSQL Cloud**, scaling down to 0 compute units during idle hours.
2. **Local Hybrid Speech Engine:** Utilizes **FFmpeg static binaries** + ONNX local Whisper execution for zero per-minute audio API fees when running on local nodes.
3. **Optimized RAG Vector Engine:** Native TF-IDF vector embeddings and cosine similarity search run directly in memory without requiring expensive third-party vector database subscriptions.

---

## 🎯 Target Business Use Cases

| Industry / Use Case | Core Problem Solved | Value Delivered & ROI |
| :--- | :--- | :--- |
| **Executive Operations** | Manual preparation of Minutes of Meeting (MOM). | **80% reduction in meeting admin time.** Auto-generates MOM with decisions, owners, and risks. |
| **Sales & Revenue Operations** | Deal friction and untracked buyer objections in sales calls. | **25% faster deal cycle.** Identifies key risks, customer requirements, and follow-ups. |
| **Engineering & Product Syncs** | Technical trade-offs and tasks getting lost in long recordings. | **Zero missed deliverables.** Auto-extracts action items with assignees, due dates, and status checkboxes. |
| **Legal & Compliance** | Auditability of verbal agreements and policy discussions. | **Full compliance record.** Clickable timestamp citations (`Source: [MM:SS]`) linked directly to exact audio lines. |

---

## 🛠️ End-to-End Technical Architecture

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as 3-Panel SaaS UI (Next.js 16)
    participant API as Upload REST API (/api/upload)
    participant FFmpeg as FFmpeg Audio Converter
    participant Whisper as Whisper Speech Engine
    participant LLM as LlamaCloud / Claude LLM
    participant RAG as Vector RAG Engine
    participant DB as Neon PostgreSQL DB

    User->>UI: Upload Video (.mp4 / .mov / .mp3)
    UI->>API: POST /api/upload (FormData)
    API->>FFmpeg: Convert to 16kHz 16-bit Mono PCM WAV
    FFmpeg-->>API: Processed Audio Buffer
    API->>Whisper: Transcribe PCM Audio
    Whisper-->>API: Timestamped Dialogue Transcript [MM:SS]
    API->>LLM: Extract Structured Intelligence JSON
    LLM-->>API: Summary, Decisions, Actions, Risks
    API->>RAG: Index Semantic Chunks & Compute Vectors
    API->>DB: Save Meeting Record & Analysis
    API-->>UI: Return Completed Meeting Payload
    User->>UI: Ask Question in AI Copilot Chat
    UI->>RAG: POST /api/meetings/[id]/chat { message }
    RAG-->>UI: Grounded Answer with Timestamp Citations [MM:SS]
```

---

## 🔥 Key Product Features

### 1. 3-Panel Modern SaaS Dashboard
- **Left Navigation Sidebar:** Sleek SaaS navigation (Dashboard, Meetings, Upload, Analytics, Settings).
- **Center Content Panel:** Dual-tab workspace switching between **Summary & Insights** and **Full Transcript**.
- **Right AI Copilot Panel:** Contextual RAG chat widget grounded in the meeting context.

### 2. High-Precision Speech-to-Text Pipeline
- Converts raw media containers into **16kHz 16-bit mono PCM WAV** format using FFmpeg.
- Generates formatted dialogue text with exact timestamps (`[MM:SS]`) and speaker labels (`Speaker 1`, `Speaker 2`).

### 3. Automated Executive Intelligence Extraction
- **Executive Summary:** High-level overview of meeting discussions.
- **Key Discussion Themes:** Major topics covered.
- **Decisions Log:** Formal decisions paired with context and decision-makers.
- **Action Items Matrix:** Task descriptions with assignees, due dates, and interactive status checkboxes.
- **Risk Radar:** Severity-coded risk warnings (`High`, `Medium`, `Low`) paired with concrete mitigation plans.

### 4. Single-Source Vector RAG Engine & AI Copilot
- Dynamically indexes semantic transcript chunks.
- Computes vector embeddings and performs cosine similarity search.
- Answers user queries with grounded, complete responses featuring clickable **timestamp citations** (`Source: [MM:SS]`).

### 5. Chrome Extension (Live Meeting Assistant)
- Manifest V3 extension featuring side-panel support for live recording, real-time transcription, and live meeting chat alongside Google Meet or Zoom calls.

---

## 💻 Technology Stack

- **Framework:** Next.js 16 (App Router + React + TypeScript)
- **Styling:** Vanilla CSS & Tailwind CSS (Custom Dark Mode & Glassmorphic SaaS Aesthetics)
- **Audio Processing:** `ffmpeg-static` (16kHz PCM WAV Extraction)
- **Speech Recognition:** OpenAI Whisper API / ONNX `@xenova/transformers`
- **AI Analytics & Intelligence:** LlamaCloud API / Anthropic Claude 3.5 Sonnet
- **Database & Storage:** Neon Serverless PostgreSQL (`pg` Connection Pooling)
- **Vector Search:** Custom In-Memory TF-IDF Vector Engine & Cosine Similarity

---

## ⚡ Getting Started (Local Development)

### 1. Prerequisites
- **Node.js:** `v18.x` or higher
- **npm:** `v9.x` or higher

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/CHHARSHITHAREDDY/AI-Meeting-Intelligence-Platform.git

# Navigate to directory
cd AI-Meeting-Intelligence-Platform

# Install dependencies
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://neondb_owner:YOUR_NEON_DB_PASSWORD@ep-rough-union-a1axi18m-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
JWT_SECRET="your-secure-jwt-secret-key"
LLAMA_API_KEY="your-llamacloud-api-key"
OPENAI_API_KEY="your-openai-api-key"        # Optional
ANTHROPIC_API_KEY="your-anthropic-api-key"  # Optional
PORT=3000
```

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to launch the platform.

### 5. Production Build Verification
To compile and test the production bundle:
```bash
npm run build
```

---

## 🧩 Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer Mode** (top-right toggle).
3. Click **Load Unpacked** and select the `/extension` directory in this project.
4. Launch the side panel assistant alongside any Google Meet or Zoom tab!

---

## 🏆 Hackathon Pitch Summary

| Criteria | Strategy |
| :--- | :--- |
| **Market Opportunity** | B2B Productivity & Executive Meeting Management ($12B TAM) |
| **Technical Innovation** | Single-Source Meeting Context Store pairing Whisper STT with TF-IDF Vector RAG |
| **User Experience** | Instant 3-panel SaaS workflow requiring zero manual note-taking |
| **Unit Margins** | ~90% Gross Margin through hybrid serverless execution |

---

*Developed for the Startup Hackathon — AI Meeting Intelligence SaaS.*
