import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src";

function createMockEnv(overrides = {}) {
	const base = {
		...env,
		FILE_STORAGE: {
			get: async () => null,
			put: async () => {},
		},
		CONVERTAPI_SECRET: "test-secret",
	};
	return { ...base, ...overrides };
}

describe("File Forge worker", () => {
	it("responds to OPTIONS preflight with CORS headers", async () => {
		const request = new Request("http://example.com/process", { method: "OPTIONS" });
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createMockEnv(), ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
		expect(response.headers.get("Access-Control-Allow-Methods")).toContain("OPTIONS");
	});

	it("returns health text on unknown route", async () => {
		const request = new Request("http://example.com/unknown");
		const response = await SELF.fetch(request);
		expect(await response.text()).toBe("File Forge API v2 is Live");
	});

	describe("/process", () => {
		it("returns 415 for unsupported content type", async () => {
			const request = new Request("http://example.com/process", {
				method: "POST",
				headers: { "content-type": "text/plain" },
				body: "hello",
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, createMockEnv(), ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(415);
			const data = await response.json();
			expect(data.error).toContain("Content-Type không được hỗ trợ");
		});

		it("returns 400 when JSON body misses fileKey", async () => {
			const request = new Request("http://example.com/process", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ action: "Split PDF", options: "1-2" }),
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, createMockEnv(), ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toContain("Thiếu fileKey");
		});

		it("returns 400 when action is missing in multipart", async () => {
			const form = new FormData();
			form.append("file", new File([new Uint8Array([1, 2, 3])], "a.pdf", { type: "application/pdf" }));

			const request = new Request("http://example.com/process", {
				method: "POST",
				body: form,
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, createMockEnv(), ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toContain("Thiếu tham số action");
		});
	});

	describe("/get-presigned-url", () => {
		it("returns 400 for missing input", async () => {
			const request = new Request("http://example.com/get-presigned-url", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({}),
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, createMockEnv(), ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toContain("Thiếu fileName hoặc contentType");
		});
	});

	describe("/download/:file", () => {
		it("returns 404 when file does not exist", async () => {
			const request = new Request("http://example.com/download/not-found.pdf");
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, createMockEnv(), ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(404);
			expect(await response.text()).toBe("File không tồn tại");
		});
	});
});
