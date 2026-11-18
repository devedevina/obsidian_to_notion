// Minimal Notion API client built on Obsidian's requestUrl (no CORS issues, works on mobile).
import { requestUrl } from "obsidian";
import type { Block } from "./markdown";

const API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const CHUNK = 100; // Notion: max 100 children per request

export class NotionError extends Error {
	constructor(public status: number, public code: string, message: string) {
		super(message);
	}
}

export type DatabaseInfo = {
	titleProperty: string;
	properties: Record<string, { type: string }>;
};

export type Target = DatabaseInfo & { kind: "database" | "page"; id: string };

const sleep =(ms: number) => new Promise((r) => setTimeout(r, ms));

/** Accepts a raw ID or a full Notion URL and returns the 32-char ID. */
export function extractId(input: string): string {
	const s = input.trim();
	const dashed = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(s);
	if (dashed) return dashed[0].replace(/-/g, "");
	const path = s.split("?")[0];
	const plain = /[0-9a-f]{32}/i.exec(path);
	return plain ? plain[0] : s;
}

export class NotionClient {
	constructor(private token: string) {}

	private call(method: string, path: string, body?: unknown): Promise<any> {
		return this.raw(
			method,
			path,
			body === undefined ? undefined : JSON.stringify(body),
			body === undefined ? undefined : "application/json",
		);
	}

	private async raw(
		method: string,
		path: string,
		body?: string | ArrayBuffer,
		contentType?: string,
		attempt = 0,
	): Promise<any> {
		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.token}`,
			"Notion-Version": NOTION_VERSION,
		};
		if (contentType) headers["Content-Type"] = contentType;
		const res = await requestUrl({ url: `${API}${path}`, method, headers, body, throw: false });

		if (res.status === 429 || res.status >= 500) {
			if (attempt < 5) {
				const retry = Number(res.headers?.["retry-after"] ?? res.headers?.["Retry-After"]);
				await sleep((Number.isFinite(retry) && retry > 0 ? retry * 1000 : 1000) * (attempt + 1));
				return this.raw(method, path, body, contentType, attempt + 1);
			}
		}
		if (res.status >= 400) {
			let code = "error";
			let message = `HTTP ${res.status}`;
			try {
				const j = res.json;
				code = j.code ?? code;
				message = j.message ?? message;
			} catch {
				/* not JSON */
			}
			throw new NotionError(res.status, code, message);
		}
		return res.json;
	}

	/**
	 * Uploads a file with Notion's File Upload API and returns its upload ID,
	 * which can then be used in an image/pdf/file block within one hour.
	 */
	async uploadFile(filename: string, contentType: string, data: ArrayBuffer): Promise<string> {
		const created = await this.call("POST", "/file_uploads", { filename, content_type: contentType });

		const boundary = `----obsidian-to-notion-${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
		const enc = new TextEncoder();
		const safeName = filename.replace(/["\r\n]/g, "_");
		const head = enc.encode(
			`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeName}"\r\n` +
				`Content-Type: ${contentType}\r\n\r\n`,
		);
		const tail = enc.encode(`\r\n--${boundary}--\r\n`);
		const bytes = new Uint8Array(head.length + data.byteLength + tail.length);
		bytes.set(head, 0);
		bytes.set(new Uint8Array(data), head.length);
		bytes.set(tail, head.length + data.byteLength);

		await this.raw(
			"POST",
			`/file_uploads/${created.id}/send`,
			bytes.buffer,
			`multipart/form-data; boundary=${boundary}`,
		);
		return created.id as string;
	}

	async getDatabase(id: string): Promise<DatabaseInfo> {
		const db = await this.call("GET", `/databases/${id}`);
		const properties: DatabaseInfo["properties"] = db.properties ?? {};
		const titleProperty = Object.keys(properties).find((k) => properties[k].type === "title") ?? "Name";
		return { titleProperty, properties };
	}

	/**
	 * Resolves the upload target. A database gets notes as rows; a plain page
	 * gets them as sub-pages (title only, no tag property).
	 */
	async getTarget(id: string): Promise<Target> {
		try {
			const db = await this.getDatabase(id);
			return { kind: "database", id, ...db };
		} catch (e) {
			if (e instanceof NotionError && (e.status === 400 || e.status === 404)) {
				try {
					await this.call("GET", `/pages/${id}`);
					return { kind: "page", id, titleProperty: "title", properties: {} };
				} catch {
					/* fall through to the original error */
				}
			}
			throw e;
		}
	}

	async createPage(target: Target, properties: Record<string, any>, children: Block[]) {
		const page = await this.call("POST", "/pages", {
			parent: target.kind === "database" ? { database_id: target.id } : { page_id: target.id },
			properties,
			children: children.slice(0, CHUNK),
		});
		await this.appendChildren(page.id, children.slice(CHUNK));
		return page as { id: string; url: string };
	}

	async updatePage(pageId: string, properties: Record<string, any>, children: Block[]) {
		const page = await this.call("PATCH", `/pages/${pageId}`, { properties, archived: false });
		await this.clearChildren(pageId);
		await this.appendChildren(pageId, children);
		return page as { id: string; url: string };
	}

	private async appendChildren(blockId: string, children: Block[]) {
		for (let i = 0; i < children.length; i += CHUNK) {
			await this.call("PATCH", `/blocks/${blockId}/children`, { children: children.slice(i, i + CHUNK) });
		}
	}

	private async clearChildren(blockId: string) {
		const ids: string[] = [];
		let cursor: string | undefined;
		do {
			const q = cursor ? `?page_size=100&start_cursor=${cursor}` : "?page_size=100";
			const res = await this.call("GET", `/blocks/${blockId}/children${q}`);
			for (const b of res.results) ids.push(b.id);
			cursor = res.has_more ? res.next_cursor : undefined;
		} while (cursor);
		for (const id of ids) await this.call("DELETE", `/blocks/${id}`);
	}
}
