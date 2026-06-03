# ChatDocs — Resumen del proyecto

**ChatDocs** es una aplicación RAG (Retrieval-Augmented Generation) que permite subir archivos Markdown y hacer preguntas sobre su contenido usando IA.

## Stack tecnológico

| Capa          | Tecnología                          |
| ------------- | ----------------------------------- |
| Frontend      | Next.js 16 (App Router), React 19   |
| Estilos       | Tailwind CSS v4                     |
| State manager | Zustand                             |
| Base de datos | SQLite via Drizzle ORM              |
| AI            | OpenAI API (embeddings + chat)      |

## Flujo de funcionamiento

1. **Subir** un archivo `.md` → se divide en fragmentos con solapamiento y se convierten a embeddings via OpenAI.
2. **Preguntar** → la pregunta se convierte a embedding y se compara con los fragmentos usando similitud coseno.
3. **Respuesta** → la IA genera una respuesta basada en los fragmentos relevantes, mostrando citas de las fuentes originales.

## Características principales

- Subida de archivos Markdown (drag & drop)
- Búsqueda semántica con chunking jerárquico
- Respuestas en streaming con efecto typewriter (SSE)
- Gestión de conversaciones con títulos automáticos e historial
- Citas a las fuentes originales (documento y sección)
- Cancelación de generación en curso
- Tema oscuro y diseño responsive

## Estructura del proyecto

```
src/
├── app/
│   ├── page.tsx           # Página principal
│   └── api/               # API routes (documentos, conversaciones, chat)
├── components/            # Componentes React
├── lib/                   # Lógica compartida
├── db/                    # Schema y configuración de Drizzle
└── ...
```
