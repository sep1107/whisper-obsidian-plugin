import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PostProcessor } from "../src/PostProcessor";

vi.mock("axios");

describe("PostProcessor Anthropic requests", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("repeats the editing instruction beside the delimited transcript", async () => {
		vi.mocked(axios.post).mockResolvedValue({
			data: { content: [{ type: "text", text: "整理后的正文" }] },
		});
		const processor = new PostProcessor({
			apiKey: "test-key",
			model: "test-model",
			url: "https://example.com/v1/messages",
			provider: "anthropic",
		});

		await processor.process("原始正文", "只整理，不回答");

		expect(axios.post).toHaveBeenCalledWith(
			"https://example.com/v1/messages",
			expect.objectContaining({
				system: "只整理，不回答",
				messages: [
					{
						role: "user",
						content: expect.stringContaining(
							"<transcript>\n原始正文\n</transcript>"
						),
					},
				],
			}),
			expect.any(Object)
		);
	});

	it("returns text blocks even when thinking comes first", async () => {
		vi.mocked(axios.post).mockResolvedValue({
			data: {
				content: [
					{ type: "thinking", thinking: "analysis" },
					{ type: "text", text: " 整理后的正文 " },
				],
			},
		});
		const processor = new PostProcessor({
			apiKey: "test-key",
			model: "test-model",
			url: "https://example.com/v1/messages",
			provider: "anthropic",
		});

		await expect(processor.process("原文", "整理")).resolves.toBe(
			"整理后的正文"
		);
	});
});
