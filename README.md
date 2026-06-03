# ChatDocs

Upload Markdown files and ask questions about their content using AI. Built with Next.js, Drizzle ORM, SQLite, and OpenAI.

## How it works

1. **Upload** a `.md` file — the content is split into chunks and converted to embeddings via OpenAI
2. **Ask** a question about the document — the question is embedded and matched against document chunks using cosine similarity
3. **Get** an AI answer grounded in the relevant document sections with source citations

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Zustand
- **Backend**: Next.js API routes (serverless)
- **Database**: SQLite via Drizzle ORM (zero-setup, local-first)
- **AI**: OpenAI API (embeddings + chat completions)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.local` and fill in your OpenAI-compatible API key:

```env
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### 3. Initialize the database

```bash
npx drizzle-kit push
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and upload a `.md` file to get started.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/[conversationId]   # Streaming RAG chat
│   │   ├── conversations/          # CRUD conversations
│   │   └── documents/              # CRUD documents
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── chat/                       # Chat UI components
│   ├── documents/                  # File upload + document list
│   └── ui/                         # Primitive UI components
├── db/
│   ├── index.ts                    # Drizzle client
│   └── schema.ts                   # Tables: documents, chunks, conversations, messages, conversation_documents
├── lib/
│   ├── chat.ts                     # System prompt builder + streaming
│   ├── chunker.ts                  # Markdown chunking with overlap
│   ├── constants.ts
│   ├── embeddings.ts               # OpenAI embedding calls
│   ├── openai.ts                   # OpenAI client
│   ├── utils.ts                    # cn(), uuid(), now()
│   └── vector.ts                   # Cosine similarity + top-K
├── stores/
│   ├── chat-store.ts               # Zustand state for conversations
│   └── documents-store.ts          # Zustand state for documents
└── types/
    └── index.ts
```

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/documents` | POST | Upload + chunk + embed a markdown file |
| `/api/documents` | GET | List all documents |
| `/api/documents/[id]` | DELETE | Remove a document and its chunks |
| `/api/conversations` | GET | List all conversations |
| `/api/conversations` | POST | Create a new conversation |
| `/api/conversations/[id]` | GET | Get conversation with messages and linked docs |
| `/api/conversations/[id]` | DELETE | Delete a conversation |
| `/api/chat/[conversationId]` | POST | Ask a question (streaming SSE response) |

## Features

- Drag-and-drop markdown file upload
- Hierarchical text chunking with configurable overlap
- Semantic search via cosine similarity
- Streaming AI responses with typewriter effect
- Conversation history with auto-title from first message
- Source citations (document name + section heading)
- Abort in-progress generation
- Dark theme
- Responsive layout (mobile sidebar drawer)
