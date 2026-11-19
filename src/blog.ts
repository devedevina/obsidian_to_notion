// "Copy for blog": renders a note to clean HTML with images inlined, and puts it on the
// clipboard so it can be pasted straight into a blog editor (Naver, Tistory, Brunch, …).
import { App, Component, MarkdownRenderer, TFile } from "obsidian";

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/;
const EMBED_RE = /!\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]|!\[([^\]]*)\]\(([^)\s]+)\)/g;
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);
const MAX_WIDTH = 1600; // blog editors shrink anyway; keeps the clipboard small

export type BlogCopyResult = { images: number; skipped: string[] };

export async function copyNoteForBlog(app: App, file: TFile): Promise<BlogCopyResult> {
	const raw = await app.vault.read(file);
	const body = raw.replace(FRONTMATTER_RE, "");
	const skipped: string[] = [];
	let images = 0;

	// 1. Swap local embeds for data-URI images so the pasted post carries the pictures.
	const md = await replaceOutsideCode(body, async (text) => {
		const parts: string[] = [];
		let last = 0;
		for (const m of text.matchAll(EMBED_RE)) {
			parts.push(text.slice(last, m.index));
			last = (m.index ?? 0) + m[0].length;
			const link = (m[1] ?? m[3] ?? "").trim();
			const alt = m[2] ?? "";
			if (/^https?:\/\//i.test(link)) {
				parts.push(m[0]);
				continue;
			}
			let path = link;
			try {
				path = decodeURIComponent(link.replace(/^<|>$/g, ""));
			} catch {
				/* keep */
			}
			const att = app.metadataCache.getFirstLinkpathDest(path, file.path);
			if (!att || !IMAGE_EXT.has(att.extension.toLowerCase())) {
				skipped.push(path);
				continue;
			}
			const uri = await toDataUri(app, att);
			images++;
			parts.push(`![${alt.replace(/[[\]]/g, "")}](${uri})`);
		}
		parts.push(text.slice(last));
		return parts.join("");
	});

	// 2. Render with Obsidian's own renderer, then strip app-only markup.
	const holder = document.createElement("div");
	const component = new Component();
	component.load();
	try {
		await MarkdownRenderer.render(app, md, holder, file.path, component);
		cleanHtml(holder);
	} finally {
		component.unload();
	}

	const html = `<meta charset="utf-8">${holder.innerHTML}`;
	// Markdown editors (Velog, GitHub, …) take the plain-text flavour: hand them the original Markdown.
	const plain = body.trim();

	// 3. Write rich HTML + plain text to the clipboard.
	await navigator.clipboard.write([
		new ClipboardItem({
			"text/html": new Blob([html], { type: "text/html" }),
			"text/plain": new Blob([plain], { type: "text/plain" }),
		}),
	]);
	return { images, skipped };
}

/** Runs `fn` on text outside fenced code blocks and inline code. */
async function replaceOutsideCode(md: string, fn: (s: string) => Promise<string>): Promise<string> {
	const chunks = md.split(/(^[ \t]*(?:```|~~~)[\s\S]*?^[ \t]*(?:```|~~~)[ \t]*$|`[^`\n]*`)/m);
	const out: string[] = [];
	for (let i = 0; i < chunks.length; i++) out.push(i % 2 === 1 ? chunks[i] : await fn(chunks[i]));
	return out.join("");
}

async function toDataUri(app: App, file: TFile): Promise<string> {
	const data = await app.vault.readBinary(file);
	const ext = file.extension.toLowerCase();
	const mime =
		ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "svg" ? "image/svg+xml" : `image/${ext}`;
	const blob = new Blob([data], { type: mime });
	if (ext === "svg" || ext === "gif") return blobToDataUri(blob); // keep vectors / animation
	try {
		return await downscale(blob, mime);
	} catch {
		return blobToDataUri(blob);
	}
}

function blobToDataUri(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => resolve(String(r.result));
		r.onerror = () => reject(r.error);
		r.readAsDataURL(blob);
	});
}

async function downscale(blob: Blob, mime: string): Promise<string> {
	const bitmap = await createImageBitmap(blob);
	if (bitmap.width <= MAX_WIDTH) {
		bitmap.close();
		return blobToDataUri(blob);
	}
	const scale = MAX_WIDTH / bitmap.width;
	const canvas = document.createElement("canvas");
	canvas.width = MAX_WIDTH;
	canvas.height = Math.round(bitmap.height * scale);
	const ctx = canvas.getContext("2d")!;
	ctx.imageSmoothingQuality = "high";
	ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();
	return mime === "image/jpeg" ? canvas.toDataURL("image/jpeg", 0.9) : canvas.toDataURL("image/png");
}

/** Removes Obsidian-only elements and attributes so blog editors get plain, tidy HTML. */
function cleanHtml(root: HTMLElement) {
	// UI bits the renderer adds
	root.querySelectorAll(
		"button, .copy-code-button, .collapse-indicator, .list-collapse-indicator, .heading-collapse-indicator, .frontmatter, .frontmatter-container, .callout-icon, .callout-fold, svg",
	).forEach((el) => el.remove());

	// Internal links and #tags → plain text
	root.querySelectorAll("a.internal-link, a.tag").forEach((a) => {
		a.replaceWith(document.createTextNode(a.textContent ?? ""));
	});

	// Leftover embeds that weren't images (notes, PDFs, …) → filename text
	root.querySelectorAll(".internal-embed").forEach((el) => {
		const name = el.getAttribute("src") ?? el.textContent ?? "";
		el.replaceWith(document.createTextNode(name ? `📎 ${name}` : ""));
	});

	// Callouts → blockquote with a bold title
	root.querySelectorAll(".callout").forEach((c) => {
		const bq = document.createElement("blockquote");
		const title = c.querySelector(".callout-title")?.textContent?.trim();
		if (title) {
			const p = document.createElement("p");
			const b = document.createElement("strong");
			b.textContent = title;
			p.appendChild(b);
			bq.appendChild(p);
		}
		const content = c.querySelector(".callout-content");
		if (content) while (content.firstChild) bq.appendChild(content.firstChild);
		c.replaceWith(bq);
	});

	// Task list checkboxes → ☐ / ☑ characters (editors usually drop <input>)
	root.querySelectorAll("input[type=checkbox]").forEach((cb) => {
		const checked = (cb as HTMLInputElement).checked || cb.hasAttribute("checked");
		cb.replaceWith(document.createTextNode(checked ? "☑ " : "☐ "));
	});

	// Images: make them fit the editor width
	root.querySelectorAll("img").forEach((img) => {
		img.removeAttribute("width");
		img.removeAttribute("height");
		img.setAttribute("style", "max-width:100%;height:auto;");
	});

	// Strip class/data-* attributes
	root.querySelectorAll("*").forEach((el) => {
		for (const attr of Array.from(el.attributes)) {
			if (attr.name === "class" || attr.name.startsWith("data-") || attr.name === "dir" || attr.name === "spellcheck")
				el.removeAttribute(attr.name);
		}
	});
}
