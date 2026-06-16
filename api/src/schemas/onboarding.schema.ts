import { z } from "zod";

export const updateOnboardingSchema = z.record(z.string(), z.any());