import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	parseFrontMatterTags,
} from "obsidian";
import { Block, LOCAL_FILE, markdownToBlocks } from "./markdown";
import { NotionClient, NotionError, extractId } from "./notion";

// Single-part uploads are capped at 20MB (free Notion workspaces: 5MB per file).
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const MIME: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
	heic: "image/heic",
	tif: "image/tiff",
	tiff: "image/tiff",
	ico: "image/vnd.microsoft.icon",
	pdf: "application/pdf",
};

interface Settings {
	token: string;
	databaseId: string;
	tagsProperty: string;
}

const DEFAULT_SETTINGS: Settings = {
	token: "",
	databaseId: "",
	tagsProperty: "Tags",
};

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/;

export default class ObsidianToNotion extends Plugin {
	settings: Settings = DEFAULT_SETTINGS;
	private busy = new Set<string>();

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon("upload-cloud", "현재 노트를 Notion에 올리기", () => {
			const file = this.app.workspace.getActiveFile();
			if (file) this.upload(file);
			else new Notice("열려 있는 노트가 없어요.");
		});

		this.addCommand({
			id: "upload-current-note",
			name: "현재 노트를 Notion에 올리기",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== "md") return false;
				if (!checking) this.upload(file);
				return true;
			},
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!(file instanceof TFile) || file.extension !== "md") return;
				menu.addItem((item) =>
					item
						.setTitle("Notion으로 보내기")
						.setIcon("upload-cloud")
						.onClick(() => this.upload(file)),
				);
			}),
		);

		this.addSettingTab(new NotionSettingTab(this.app, this));
	}

	async upload(file: TFile) {
		const { token, databaseId: rawDb, tagsProperty } = this.settings;
		if (!token || !rawDb) {
			new Notice("설정 → Obsidian to Notion에서 토큰과 데이터베이스 ID를 먼저 입력해 주세요.");
			return;
		}
		if (this.busy.has(file.path)) return;
		this.busy.add(file.path);
		const progress = new Notice(`Notion에 올리는 중… (${file.basename})`, 0);

		try {
			const client = new NotionClient(token);
			const db = await client.getTarget(extractId(rawDb));

			const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
			const raw = await this.app.vault.read(file);
			const body = raw.replace(FRONTMATTER_RE, "");
			const blocks = markdownToBlocks(body);
			const attach = await this.resolveAttachments(client, file, blocks, progress);

			const title = typeof fm.title === "string" && fm.title.trim() ? fm.title.trim() : file.basename;
			const properties: Record<string, any> = {
				[db.titleProperty]: { title: [{ type: "text", text: { content: title.slice(0, 2000) } }] },
			};

			if (tagsProperty && db.properties[tagsProperty]?.type === "multi_select") {
				const tags = (parseFrontMatterTags(fm) ?? [])
					.map((t) => t.replace(/^#/, "").replace(/,/g, " ").trim())
					.filter(Boolean);
				properties[tagsProperty] = { multi_select: [...new Set(tags)].map((name) => ({ name: name.slice(0, 100) })) };
			}

			const existingId = typeof fm.notion_id === "string" ? fm.notion_id : undefined;
			let page: { id: string; url: string };
			let updated = false;

			if (existingId) {
				try {
					page = await client.updatePage(existingId, properties, blocks);
					updated = true;
				} catch (e) {
					// Page was deleted or the integration lost access → create a fresh one.
					if (e instanceof NotionError && (e.status === 404 || e.code === "object_not_found")) {
						page = await client.createPage(db, properties, blocks);
					} else throw e;
				}
			} else {
				page = await client.createPage(db, properties, blocks);
			}

			await this.app.fileManager.processFrontMatter(file, (front) => {
				front.notion_id = page.id;
				front.notion_url = page.url;
			});

			progress.hide();
			new Notice(updated ? `✅ Notion 페이지를 업데이트했어요: ${title}` : `✅ Notion에 새 페이지를 만들었어요: ${title}`);
			if (attach.failed.length) {
				new Notice(`⚠️ 첨부파일 ${attach.failed.length}개는 올리지 못했어요:\n${attach.failed.join("\n")}`, 12000);
			}
		} catch (e) {
			progress.hide();
			console.error("[obsidian-to-notion]", e);
			new Notice(`❌ Notion 업로드 실패: ${explain(e)}`, 10000);
		} finally {
			this.busy.delete(file.path);
		}
	}

	/**
	 * Replaces local-file placeholder blocks with uploaded Notion image/PDF blocks.
	 * Anything that can't be uploaded becomes a short text line instead.
	 */
	private async resolveAttachments(client: NotionClient, note: TFile, blocks: Block[], progress: Notice) {
		const failed: string[] = [];
		const cache = new Map<string, string>(); // vault path → upload id (same image used twice)
		// Collect placeholders at any depth (images can sit inside list items).
		const targets: { list: Block[]; idx: number; b: Block }[] = [];
		const walk = (list: Block[]) =>
			list.forEach((b, idx) => {
				if (b.type === LOCAL_FILE) targets.push({ list, idx, b });
				else if (Array.isArray(b[b.type]?.children)) walk(b[b.type].children);
			});
		walk(blocks);

		let n = 0;
		for (const { list, idx, b } of targets) {
			const blocks = list;
			const { link, caption } = b[LOCAL_FILE] as { link: string; caption: string };
			const fallback = (reason: string) => {
				failed.push(`${link} (${reason})`);
				blocks[idx] = {
					object: "block",
					type: "paragraph",
					paragraph: { rich_text: [{ type: "text", text: { content: `📎 첨부: ${link}` } }] },
				};
			};

			const att = this.app.metadataCache.getFirstLinkpathDest(link, note.path);
			if (!att) {
				fallback("보관함에서 찾을 수 없음");
				continue;
			}
			const ext = att.extension.toLowerCase();
			const contentType = MIME[ext];
			if (!contentType) {
				fallback(`지원하지 않는 형식 .${ext}`);
				continue;
			}
			if (att.stat.size > MAX_UPLOAD_BYTES) {
				fallback(`${(att.stat.size / 1024 / 1024).toFixed(1)}MB, 20MB 초과`);
				continue;
			}

			n++;
			progress.setMessage(`Notion에 올리는 중… 첨부파일 ${n}/${targets.length}`);
			try {
				let id = cache.get(att.path);
				if (!id) {
					id = await client.uploadFile(att.name, contentType, await this.app.vault.readBinary(att));
					cache.set(att.path, id);
				}
				const kind = ext === "pdf" ? "pdf" : "image";
				const cap = caption || "";
				blocks[idx] = {
					object: "block",
					type: kind,
					[kind]: {
						type: "file_upload",
						file_upload: { id },
						caption: cap ? [{ type: "text", text: { content: cap.slice(0, 2000) } }] : [],
					},
				};
			} catch (e) {
				console.error("[obsidian-to-notion] attachment", link, e);
				fallback(explain(e));
			}
		}
		return { failed };
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

function explain(e: unknown): string {
	if (e instanceof NotionError) {
		if (e.status === 401) return "토큰이 올바르지 않아요. 설정에서 토큰을 확인해 주세요.";
		if (e.status === 404 || e.code === "object_not_found")
			return "데이터베이스를 찾을 수 없어요. ID를 확인하고, 데이터베이스에 Integration을 연결했는지 확인해 주세요.";
		if (e.code === "validation_error") return `노션이 내용을 거부했어요: ${e.message}`;
		return `${e.message} (${e.status})`;
	}
	return e instanceof Error ? e.message : String(e);
}

class NotionSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: ObsidianToNotion) {
		super(app, plugin);
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Notion Integration 토큰")
			.setDesc("notion.so/profile/integrations 에서 만든 내부 Integration의 시크릿 토큰")
			.addText((t) => {
				t.inputEl.type = "password";
				t.setPlaceholder("ntn_...")
					.setValue(this.plugin.settings.token)
					.onChange(async (v) => {
						this.plugin.settings.token = v.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("데이터베이스 또는 페이지 링크")
			.setDesc("노트를 올릴 Notion 데이터베이스(또는 일반 페이지)의 링크나 ID")
			.addText((t) =>
				t
					.setPlaceholder("https://www.notion.so/...")
					.setValue(this.plugin.settings.databaseId)
					.onChange(async (v) => {
						this.plugin.settings.databaseId = v.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("태그 속성 이름")
			.setDesc("frontmatter의 tags를 넣을 Multi-select 속성 이름. 데이터베이스에 없으면 건너뛰어요.")
			.addText((t) =>
				t.setValue(this.plugin.settings.tagsProperty).onChange(async (v) => {
					this.plugin.settings.tagsProperty = v.trim();
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("연결 테스트")
			.setDesc("토큰과 데이터베이스 설정이 맞는지 확인해요.")
			.addButton((b) =>
				b.setButtonText("테스트").onClick(async () => {
					try {
						const db = await new NotionClient(this.plugin.settings.token).getTarget(
							extractId(this.plugin.settings.databaseId),
						);
						if (db.kind === "page") {
							new Notice("✅ 연결 성공! 일반 페이지라서 노트가 이 페이지의 하위 페이지로 올라가요. (태그는 데이터베이스에서만 지원)");
							return;
						}
						const tagProp = this.plugin.settings.tagsProperty;
						const tagOk = db.properties[tagProp]?.type === "multi_select";
						new Notice(
							`✅ 연결 성공! 제목 속성: "${db.titleProperty}"` +
								(tagProp ? (tagOk ? `, 태그 속성: "${tagProp}"` : ` (태그 속성 "${tagProp}"은 없어서 건너뛰어요)`) : ""),
						);
					} catch (e) {
						new Notice(`❌ 연결 실패: ${explain(e)}`, 10000);
					}
				}),
			);
	}
}
