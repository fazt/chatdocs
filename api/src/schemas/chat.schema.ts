import { z } from "zod";

export const conversationIdParamSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID format"),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").trim(),
});