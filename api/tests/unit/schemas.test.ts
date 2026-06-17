import { describe, it, expect } from "@jest/globals";
import {
  registerSchema,
  loginSchema,
  userIdParamSchema,
} from "../../src/schemas/auth.schema.js";
import {
  updateRoleSchema,
  userIdParamSchema as adminUserIdParamSchema,
} from "../../src/schemas/admin.schema.js";
import {
  chatMessageSchema,
  conversationIdParamSchema as chatConversationIdParamSchema,
} from "../../src/schemas/chat.schema.js";
import {
  createConversationSchema,
  conversationIdParamSchema,
} from "../../src/schemas/conversations.schema.js";
import { updateOnboardingSchema } from "../../src/schemas/onboarding.schema.js";

const validUuid = "123e4567-e89b-12d3-a456-426614174000";

describe("auth schemas", () => {
  describe("registerSchema", () => {
    it("accepts a valid payload", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "secret123",
        name: "User",
      });
      expect(result.success).toBe(true);
    });

    it("accepts a payload without optional name", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "secret123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = registerSchema.safeParse({
        email: "not-an-email",
        password: "secret123",
      });
      expect(result.success).toBe(false);
    });

    it("rejects password shorter than 6 chars", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "123",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing fields", () => {
      expect(registerSchema.safeParse({}).success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("accepts a valid payload", () => {
      const result = loginSchema.safeParse({
        email: "user@example.com",
        password: "x",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty password", () => {
      const result = loginSchema.safeParse({
        email: "user@example.com",
        password: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid email", () => {
      const result = loginSchema.safeParse({
        email: "bad",
        password: "x",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("userIdParamSchema", () => {
    it("accepts a valid uuid", () => {
      expect(userIdParamSchema.safeParse({ id: validUuid }).success).toBe(true);
    });

    it("rejects a non-uuid id", () => {
      expect(userIdParamSchema.safeParse({ id: "not-a-uuid" }).success).toBe(
        false
      );
    });
  });
});

describe("admin schemas", () => {
  describe("updateRoleSchema", () => {
    it("accepts 'user'", () => {
      expect(updateRoleSchema.safeParse({ role: "user" }).success).toBe(true);
    });

    it("accepts 'admin'", () => {
      expect(updateRoleSchema.safeParse({ role: "admin" }).success).toBe(true);
    });

    it("rejects unknown roles", () => {
      expect(updateRoleSchema.safeParse({ role: "owner" }).success).toBe(false);
    });

    it("rejects missing role", () => {
      expect(updateRoleSchema.safeParse({}).success).toBe(false);
    });
  });

  describe("userIdParamSchema", () => {
    it("accepts a valid uuid", () => {
      expect(
        adminUserIdParamSchema.safeParse({ id: validUuid }).success
      ).toBe(true);
    });

    it("rejects a non-uuid id", () => {
      expect(
        adminUserIdParamSchema.safeParse({ id: "123" }).success
      ).toBe(false);
    });
  });
});

describe("chat schemas", () => {
  describe("chatMessageSchema", () => {
    it("accepts a non-empty message", () => {
      expect(
        chatMessageSchema.safeParse({ message: "hello" }).success
      ).toBe(true);
    });

    it("trims whitespace", () => {
      const result = chatMessageSchema.safeParse({ message: "  hi  " });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toBe("hi");
      }
    });

    it("rejects an empty message", () => {
      expect(chatMessageSchema.safeParse({ message: "" }).success).toBe(false);
    });

    it("trims whitespace and rejects an effectively empty message", () => {
      const result = chatMessageSchema.safeParse({ message: "   " });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toBe("");
      }
    });
  });

  describe("conversationIdParamSchema", () => {
    it("accepts a valid uuid", () => {
      expect(
        chatConversationIdParamSchema.safeParse({
          conversationId: validUuid,
        }).success
      ).toBe(true);
    });

    it("rejects a non-uuid", () => {
      expect(
        chatConversationIdParamSchema.safeParse({
          conversationId: "abc",
        }).success
      ).toBe(false);
    });
  });
});

describe("conversations schemas", () => {
  describe("createConversationSchema", () => {
    it("accepts an empty payload", () => {
      expect(createConversationSchema.safeParse({}).success).toBe(true);
    });

    it("accepts title only", () => {
      const result = createConversationSchema.safeParse({ title: "My chat" });
      expect(result.success).toBe(true);
    });

    it("accepts documentIds with valid uuids", () => {
      const result = createConversationSchema.safeParse({
        documentIds: [validUuid],
      });
      expect(result.success).toBe(true);
    });

    it("rejects documentIds with invalid uuids", () => {
      const result = createConversationSchema.safeParse({
        documentIds: ["nope"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("conversationIdParamSchema", () => {
    it("accepts a valid uuid", () => {
      expect(
        conversationIdParamSchema.safeParse({ id: validUuid }).success
      ).toBe(true);
    });

    it("rejects a non-uuid", () => {
      expect(
        conversationIdParamSchema.safeParse({ id: "nope" }).success
      ).toBe(false);
    });
  });
});

describe("onboarding schemas", () => {
  it("accepts an empty object", () => {
    expect(updateOnboardingSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a record of string->any", () => {
    expect(
      updateOnboardingSchema.safeParse({
        step: 2,
        role: "dev",
        completed: true,
      }).success
    ).toBe(true);
  });
});
