export const CHUNK_MAX_TOKENS = 1000;
export const CHUNK_OVERLAP_TOKENS = 200;
export const TOP_K_CHUNKS = 5;
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = [".md", ".markdown", ".jpg", ".jpeg", ".png", ".gif", ".webp"];
export const ALLOWED_MIME_TYPES = [
  "text/markdown",
  "text/plain",
  "text/x-markdown",
];
export const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

export const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
export const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

export const APP_NAME = "ChatDocs";
export const APP_DESCRIPTION = "Upload Markdown files and ask questions about their content.";
