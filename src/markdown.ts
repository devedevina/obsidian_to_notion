// Converts Obsidian-flavoured Markdown into Notion block objects.

export type RichText = {
	type: "text";
	text: { content: string; link?: { url: string } | null };
	annotations?: {
		bold?: boolean;
		italic?: boolean;
		strikethrough?: boolean;
		code?: boolean;
	};
};

export type Block = Record<string, any>;

const MAX_TEXT = 2000;

const NOTION_LANGUAGES = new Set([
	"abap", "arduino", "bash", "basic", "c", "clojure", "coffeescript", "c++", "c#",
	"css", "dart", "diff", "docker", "elixir", "elm", "erlang", "flow", "fortran",
	"f#", "gherkin", "glsl", "go", "graphql", "groovy", "haskell", "html", "java",
	"javascript", "json", "julia", "kotlin", "latex", "less", "lisp", "livescript",
	"lua", "makefile", "markdown", "markup", "matlab", "mermaid", "nix", "objective-c",
	"ocaml", "pascal", "perl", "php", "plain text", "powershell", "prolog", "protobuf",
	"python", "r", "reason", "ruby", "rust", "sass", "scala", "scheme", "scss", "shell",
	"sql", "swift", "typescript", "vb.net", "verilog", "vhdl", "visual basic",
	"webassembly", "xml", "yaml",
]);

const LANGUAGE_ALIASES: Record<string, string> = {
	js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
	py: "python", rb: "ruby", sh: "shell", zsh: "shell", console: "shell",
	yml: "yaml", md: "markdown", cpp: "c++", cs: "c#", csharp: "c#",
	dockerfile: "docker", kt: "kotlin", rs: "rust", tex: "latex", text: "plain text",
	txt: "plain text", "": "plain text",
};

function notionLanguage(lang: string): string {
	const l = lang.trim().toLowerCase();
	const mapped = LANGUAGE_ALIASES[l] ?? l;
	return NOTION_LANGUAGES.has(mapped) ? mapped : "plain text";
}

function isUrl(s: string): boolean {
	return /^https?:\/\/\S+$/i.test(s);
}

/** Splits long content into ≤2000-char chunks, keeping annotations. */
function pushText(out: RichText[], content: string, ann: RichText["annotations"] = {}, url?: string) {
	if (!content) return;
	for (let i = 0; i < content.length; i += MAX_TEXT) {
		const rt: RichText = {
			type: "text",
			text: { content: content.slice(i, i + MAX_TEXT), link: url ? { url } : null },
		};
		if (ann && Object.keys(ann).length) rt.annotations = { ...ann };
		out.push(rt);
	}
}

/** Parses inline Markdown: **bold**, *italic*, ~~strike~~, `code`, [text](url), [[wikilink]]. */
export function parseInline(text: string, ann: RichText["annotations"] = {}): RichText[] {
	const out: RichText[] = [];
	const pattern =
		/(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(~~[^~]+~~)|(\*[^*\s][^*]*\*|(?<!\w)_[^_\s][^_]*_(?!\w))|(!?\[\[[^\]]+\]\])|(!?\[[^\]]*\]\([^)\s]+\))|(==[^=]+==)/g;
	let last = 0;
	let m: RegExpExecArray | null;
	while ((m = pattern.exec(text)) !== null) {
		if (m.index > last) pushText(out, text.slice(last, m.index), ann);
		const tok = m[0];
		if (m[1]) {
			pushText(out, tok.slice(1, -1), { ...ann, code: true });
		} else if (m[2]) {
			out.push(...parseInline(tok.slice(2, -2), { ...ann, bold: true }));
		} else if (m[3]) {
			out.push(...parseInline(tok.slice(2, -2), { ...ann, strikethrough: true }));
		} else if (m[4]) {
			out.push(...parseInline(tok.slice(1, -1), { ...ann, italic: true }));
		} else if (m[5]) {
			// [[Note]], [[Note|Alias]], [[Note#Heading]] → plain text
			const inner = tok.replace(/^!?\[\[/, "").replace(/\]\]$/, "");
			const [target, alias] = inner.split("|");
			pushText(out, alias ?? target.replace(/#/g, " › "), ann);
		} else if (m[6]) {
			const mm = /^!?\[([^\]]*)\]\(([^)\s]+)\)$/.exec(tok)!;
			const label = mm[1] || mm[2];
			const url = mm[2];
			if (isUrl(url)) out.push(...parseInline(label, ann).map((r) => ({ ...r, text: { ...r.text, link: { url } } })));
			else pushText(out, label, ann);
		} else if (m[7]) {
			// ==highlight== → bold (Notion API colour would need extra handling)
			out.push(...parseInline(tok.slice(2, -2), { ...ann, bold: true }));
		}
		last = m.index + tok.length;
	}
	if (last < text.length) pushText(out, text.slice(last), ann);
	return out.slice(0, 100); // Notion limit: 100 rich text items per block
}

function textBlock(type: string, text: string, extra: Record<string, any> = {}): Block {
	return { object: "block", type, [type]: { rich_text: parseInline(text), ...extra } };
}

/** Placeholder for a vault attachment; replaced before sending to Notion. */
export const LOCAL_FILE = "local_file";

function localFile(link: string, caption: string): Block {
	return { object: "block", type: LOCAL_FILE, [LOCAL_FILE]: { link, caption } };
}

function codeBlock(code: string, lang: string): Block {
	const rich: RichText[] = [];
	pushText(rich, code);
	return {
		object: "block",
		type: "code",
		code: { rich_text: rich.slice(0, 100), language: notionLanguage(lang) },
	};
}

const CALLOUT_EMOJI: Record<string, string> = {
	note: "📝", info: "ℹ️", tip: "💡", hint: "💡", important: "❗", warning: "⚠️",
	caution: "⚠️", danger: "🚨", error: "🚨", bug: "🐛", example: "📌", quote: "💬",
	success: "✅", check: "✅", done: "✅", question: "❓", help: "❓", faq: "❓",
	abstract: "📋", summary: "📋", tldr: "📋", todo: "☑️", failure: "❌", fail: "❌",
};

type ListItem = { indent: number; block: Block; embeds: Block[] };

const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(\[( |x|X)\]\s+)?(.*)$/;

function listBlock(m: RegExpExecArray, content: string): Block {
	const marker = m[2];
	if (m[3] !== undefined) return textBlock("to_do", content, { checked: m[4].toLowerCase() === "x" });
	if (/^\d/.test(marker)) return textBlock("numbered_list_item", content);
	return textBlock("bulleted_list_item", content);
}

/**
 * Nests list items by indentation. Notion accepts at most two levels of
 * nesting in one request, so anything deeper is attached to the second level.
 */
function nestList(items: ListItem[]): Block[] {
	const roots: Block[] = [];
	const stack: { indent: number; block: Block; depth: number }[] = [];
	const childrenOf = (b: Block): Block[] => (b[b.type].children ??= []);
	for (const it of items) {
		while (stack.length && stack[stack.length - 1].indent >= it.indent) stack.pop();
		let parent = stack[stack.length - 1];
		while (parent && parent.depth >= 2) {
			stack.pop();
			parent = stack[stack.length - 1];
		}
		const depth = parent ? parent.depth + 1 : 0;
		if (!parent) roots.push(it.block);
		else childrenOf(parent.block).push(it.block);
		stack.push({ indent: it.indent, block: it.block, depth });

		// Images in a list item go underneath it; at the deepest level they become siblings.
		if (it.embeds.length) {
			if (depth < 2) childrenOf(it.block).push(...it.embeds);
			else childrenOf(parent!.block).push(...it.embeds);
		}
	}
	return roots;
}

const EMBED_RE = /!\[\[([^\]|]+)(\|[^\]]*)?\]\]|!\[([^\]]*)\]\(([^)\s]+)\)/g;

/** Pulls image/file embeds out of a line of text so they can become their own blocks. */
function extractEmbeds(text: string): { text: string; embeds: Block[] } {
	const embeds: Block[] = [];
	// Leave `inline code` alone: odd-numbered parts of a split on backticks are code spans.
	const parts = text.split(/(`[^`]*`)/);
	const rest = parts
		.map((part, i) => (i % 2 === 1 ? part : replaceEmbeds(part, embeds)))
		.join("");
	return { text: rest.replace(/[ \t]{2,}/g, " ").trim(), embeds };
}

function replaceEmbeds(text: string, embeds: Block[]): string {
	return text.replace(EMBED_RE, (_all, wiki, _alias, alt, src) => {
		if (wiki) {
			embeds.push(localFile(String(wiki).split("#")[0].trim(), ""));
		} else if (isUrl(src)) {
			embeds.push({
				object: "block",
				type: "image",
				image: { type: "external", external: { url: src }, caption: alt ? parseInline(alt) : [] },
			});
		} else {
			let link = String(src).replace(/^<|>$/g, "");
			try {
				link = decodeURIComponent(link);
			} catch {
				/* keep as is */
			}
			embeds.push(localFile(link, alt ?? ""));
		}
		return " ";
	});
}

function indentWidth(ws: string): number {
	return ws.replace(/\t/g, "    ").length;
}

function splitRow(line: string): string[] {
	let s = line.trim();
	if (s.startsWith("|")) s = s.slice(1);
	if (s.endsWith("|")) s = s.slice(0, -1);
	return s.split(/(?<!\\)\|/).map((c) => c.trim());
}

export function markdownToBlocks(md: string): Block[] {
	const lines = md.replace(/\r\n?/g, "\n").split("\n");
	const blocks: Block[] = [];
	let para: string[] = [];

	const flushPara = () => {
		if (para.length) {
			const { text, embeds } = extractEmbeds(para.join("\n"));
			if (text) blocks.push(textBlock("paragraph", text));
			blocks.push(...embeds);
			para = [];
		}
	};

	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		const trimmed = line.trim();

		// Blank line
		if (!trimmed) {
			flushPara();
			i++;
			continue;
		}

		// Obsidian comments %% ... %%
		if (trimmed.startsWith("%%")) {
			flushPara();
			if (!(trimmed.length > 2 && trimmed.endsWith("%%"))) {
				i++;
				while (i < lines.length && !lines[i].includes("%%")) i++;
			}
			i++;
			continue;
		}

		// Fenced code
		const fence = /^(\s*)(```+|~~~+)\s*([\w#+.-]*)/.exec(line);
		if (fence) {
			flushPara();
			const marker = fence[2];
			const code: string[] = [];
			i++;
			while (i < lines.length && !lines[i].trim().startsWith(marker)) code.push(lines[i++]);
			i++;
			blocks.push(codeBlock(code.join("\n"), fence[3]));
			continue;
		}

		// Math block $$ ... $$
		if (trimmed.startsWith("$$")) {
			flushPara();
			let expr: string;
			if (trimmed.length > 4 && trimmed.endsWith("$$")) {
				expr = trimmed.slice(2, -2);
				i++;
			} else {
				const body: string[] = [trimmed.slice(2)];
				i++;
				while (i < lines.length && !lines[i].includes("$$")) body.push(lines[i++]);
				if (i < lines.length) body.push(lines[i].replace("$$", ""));
				i++;
				expr = body.join("\n");
			}
			blocks.push({ object: "block", type: "equation", equation: { expression: expr.trim() } });
			continue;
		}

		// Heading
		const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
		if (h) {
			flushPara();
			const level = Math.min(h[1].length, 3);
			blocks.push(textBlock(`heading_${level}`, h[2].replace(/\s+#+$/, "")));
			i++;
			continue;
		}

		// Divider
		if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) {
			flushPara();
			blocks.push({ object: "block", type: "divider", divider: {} });
			i++;
			continue;
		}

		// Blockquote / callout
		if (trimmed.startsWith(">")) {
			flushPara();
			const quote: string[] = [];
			while (i < lines.length && lines[i].trim().startsWith(">")) {
				quote.push(lines[i].trim().replace(/^>\s?/, ""));
				i++;
			}
			const callout = /^\[!(\w+)\][+-]?\s*(.*)$/.exec(quote[0] ?? "");
			if (callout) {
				const kind = callout[1].toLowerCase();
				const title = callout[2] || callout[1];
				const rest = quote.slice(1).join("\n").trim();
				const rich = parseInline(title, { bold: true });
				if (rest) {
					pushText(rich, "\n");
					rich.push(...parseInline(rest));
				}
				blocks.push({
					object: "block",
					type: "callout",
					callout: {
						rich_text: rich.slice(0, 100),
						icon: { type: "emoji", emoji: CALLOUT_EMOJI[kind] ?? "📝" },
					},
				});
			} else {
				blocks.push(textBlock("quote", quote.join("\n")));
			}
			continue;
		}

		// Table
		if (trimmed.startsWith("|") && i + 1 < lines.length && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(lines[i + 1])) {
			flushPara();
			const header = splitRow(line);
			const rows: string[][] = [header];
			i += 2;
			while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(splitRow(lines[i++]));
			const width = header.length;
			blocks.push({
				object: "block",
				type: "table",
				table: {
					table_width: width,
					has_column_header: true,
					has_row_header: false,
					children: rows.map((r) => ({
						object: "block",
						type: "table_row",
						table_row: {
							cells: Array.from({ length: width }, (_, c) => parseInline((r[c] ?? "").replace(/\\\|/g, "|"))),
						},
					})),
				},
			});
			continue;
		}

		// Lists
		const li = LIST_RE.exec(line);
		if (li) {
			flushPara();
			const items: ListItem[] = [];
			while (i < lines.length) {
				const m = LIST_RE.exec(lines[i]);
				if (m) {
					const { text, embeds } = extractEmbeds(m[5]);
					items.push({ indent: indentWidth(m[1]), block: listBlock(m, text), embeds });
					i++;
				} else if (lines[i].trim() && /^\s+/.test(lines[i]) && items.length) {
					// Continuation line of the previous item
					const last = items[items.length - 1];
					const { text, embeds } = extractEmbeds(lines[i].trim());
					last.embeds.push(...embeds);
					if (text) {
						const body = last.block[last.block.type];
						if (body.rich_text.length) pushText(body.rich_text, "\n");
						body.rich_text.push(...parseInline(text));
					}
					i++;
				} else break;
			}
			blocks.push(...nestList(items));
			continue;
		}

		// Image / embed on its own line
		// Local embeds become placeholders; main.ts uploads them and swaps in real blocks.
		const embed = /^!\[\[([^\]|]+)(\|[^\]]*)?\]\]$/.exec(trimmed);
		if (embed) {
			flushPara();
			blocks.push(localFile(embed[1].split("#")[0].trim(), ""));
			i++;
			continue;
		}
		const img = /^!\[([^\]]*)\]\((\S+?)\)$/.exec(trimmed);
		if (img) {
			flushPara();
			if (isUrl(img[2])) {
				blocks.push({
					object: "block",
					type: "image",
					image: { type: "external", external: { url: img[2] }, caption: img[1] ? parseInline(img[1]) : [] },
				});
			} else {
				let link = img[2].replace(/^<|>$/g, "");
				try {
					link = decodeURIComponent(link);
				} catch {
					/* keep as is */
				}
				blocks.push(localFile(link, img[1]));
			}
			i++;
			continue;
		}

		// Paragraph text
		para.push(trimmed);
		i++;
	}
	flushPara();
	return blocks;
}
