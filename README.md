# Vocalize | AI Meeting Intelligence MVP

A premium, glassmorphic Next.js 16 web application designed to transcribe meeting recordings and extract structured intelligence dashboards: executive summaries, decisions (with context), action items (assignees, dates, interactive checkboxes), and severity-coded risk profiles.

## Key Features

- **Top Stats Ribbon**: Live counting metrics showcasing total meetings, overall action item completion rates, and high-severity risks.
- **Visual Upload Visualizer**: Drag-and-drop file upload zone displaying real-time AI pipeline status transitions ("Uploading" -> "Transcribing with Whisper" -> "Structuring with Claude 3.5 Sonnet" -> "Done").
- **Interactive Action Items**: Checkboxes that trigger client-side update updates that persist instantly back to the local database.
- **Pulsing Severity Badges**: Visual warnings for critical/high risks alongside actionable mitigations.
- **Searchable Transcript**: Dynamic client-side dialogue filter highlights keywords and tracks exact speaker timelines.
- **Export Reports**: Instant markdown report file download compiler (`.md`).
- **Secret Fallback Engine**: If no API keys are present, the app automatically runs in **Mock/Demo Mode** generating dynamic, contextual mock information so the entire pipeline can be experienced immediately out-of-the-box.

---

## Technology Stack

- **Framework**: Next.js 16 (App Router + TypeScript)
- **Styling**: Tailwind CSS v4 (Custom glassmorphism theme, dynamic animations)
- **Speech-To-Text**: OpenAI Whisper-1 API
- **AI Extraction**: Anthropic Claude 3.5 Sonnet API
- **Database**: Atomic JSON file-system database (`data/meetings.json`)

---

## Getting Started

### 1. Prerequisites

Ensure you have **Node.js 18.x or later** and **npm** installed.

### 2. Installation

Clone the repository and install dependencies:

```bash
npm install
```

### 3. Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Open `.env.local` and add your keys (optional):

```env
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

*Note: If these variables are left empty, the application will automatically activate its smart Mock Fallback engine.*

### 4. Running the App

Start the development server:

```bash
npm run dev
```

Navigate to [http://localhost:3000](http://localhost:3000) to view your new workspace. The app is pre-seeded with a sample meeting so you can test all features instantly!
