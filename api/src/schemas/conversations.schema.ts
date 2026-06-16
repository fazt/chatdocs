import { z } from "zod";

export const conversationIdParamSchema = z.object({
  id: z.string().uuid("Invalid conversation ID format"),
});

export const createConversationSchema = z.object({
  title: z.string().optional(),
  documentIds: z.array(z.string().uuid("Invalid document ID format")).optional(),
});