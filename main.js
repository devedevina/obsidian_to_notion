var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ObsidianToNotion
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/markdown.ts
var MAX_TEXT = 2e3;
var NOTION_LANGUAGES = /* @__PURE__ */ new Set([
  "abap",
  "arduino",
  "bash",
  "basic",
  "c",
  "clojure",
  "coffeescript",
  "c++",
  "c#",
  "css",
  "dart",
  "diff",
  "docker",
  "elixir",
  "elm",
  "erlang",
  "flow",
  "fortran",
  "f#",
  "gherkin",
  "glsl",
  "go",
  "graphql",
  "groovy",
  "haskell",
  "html",
  "java",
  "javascript",
  "json",
  "julia",
  "kotlin",
  "latex",
  "less",
  "lisp",
  "livescript",
  "lua",
  "makefile",
  "markdown",
  "markup",
  "matlab",
  "mermaid",
  "nix",
  "objective-c",
  "ocaml",
  "pascal",
  "perl",
  "php",
  "plain text",
  "powershell",
  "prolog",
  "protobuf",
  "python",
  "r",
  "reason",
  "ruby",
  "rust",
  "sass",
  "scala",
  "scheme",
  "scss",
  "shell",
  "sql",
  "swift",
  "typescript",
  "vb.net",
  "verilog",
  "vhdl",
  "visual basic",
  "webassembly",
  "xml",
  "yaml"
]);
var LANGUAGE_ALIASES = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rb: "ruby",
  sh: "shell",
  zsh: "shell",
  console: "shell",
  yml: "yaml",
  md: "markdown",
  cpp: "c++",
  cs: "c#",
  csharp: "c#",
  dockerfile: "docker",
  kt: "kotlin",
  rs: "rust",
  tex: "latex",
  text: "plain text",
  txt: "plain text",
  "": "plain text"
};
function notionLanguage(lang) {
  const l = lang.trim().toLowerCase();
  const mapped = LANGUAGE_ALIASES[l] ?? l;
  return NOTION_LANGUAGES.has(mapped) ? mapped : "plain text";
}
function isUrl(s) {
  return /^https?:\/\/\S+$/i.test(s);
}
function pushText(out, content, ann = {}, url) {
  if (!content) return;
  for (let i = 0; i < content.length; i += MAX_TEXT) {
    const rt = {
      type: "text",
      text: { content: content.slice(i, i + MAX_TEXT), link: url ? { url } : null }
    };
    if (ann && Object.keys(ann).length) rt.annotations = { ...ann };
    out.push(rt);
  }
}
function parseInline(text, ann = {}) {
  const out = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(~~[^~]+~~)|(\*[^*\s][^*]*\*|(?<!\w)_[^_\s][^_]*_(?!\w))|(!?\[\[[^\]]+\]\])|(!?\[[^\]]*\]\([^)\s]+\))|(==[^=]+==)/g;
  let last = 0;
  let m;
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
      const inner = tok.replace(/^!?\[\[/, "").replace(/\]\]$/, "");
      const [target, alias] = inner.split("|");
      pushText(out, alias ?? target.replace(/#/g, " \u203A "), ann);
    } else if (m[6]) {
      const mm = /^!?\[([^\]]*)\]\(([^)\s]+)\)$/.exec(tok);
      const label = mm[1] || mm[2];
      const url = mm[2];
      if (isUrl(url)) out.push(...parseInline(label, ann).map((r) => ({ ...r, text: { ...r.text, link: { url } } })));
      else pushText(out, label, ann);
    } else if (m[7]) {
      out.push(...parseInline(tok.slice(2, -2), { ...ann, bold: true }));
    }
    last = m.index + tok.length;
  }
  if (last < text.length) pushText(out, text.slice(last), ann);
  return out.slice(0, 100);
}
function textBlock(type, text, extra = {}) {
  return { object: "block", type, [type]: { rich_text: parseInline(text), ...extra } };
}
var LOCAL_FILE = "local_file";
function localFile(link, caption) {
  return { object: "block", type: LOCAL_FILE, [LOCAL_FILE]: { link, caption } };
}
function codeBlock(code, lang) {
  const rich = [];
  pushText(rich, code);
  return {
    object: "block",
    type: "code",
    code: { rich_text: rich.slice(0, 100), language: notionLanguage(lang) }
  };
}
var CALLOUT_EMOJI = {
  note: "\u{1F4DD}",
  info: "\u2139\uFE0F",
  tip: "\u{1F4A1}",
  hint: "\u{1F4A1}",
  important: "\u2757",
  warning: "\u26A0\uFE0F",
  caution: "\u26A0\uFE0F",
  danger: "\u{1F6A8}",
  error: "\u{1F6A8}",
  bug: "\u{1F41B}",
  example: "\u{1F4CC}",
  quote: "\u{1F4AC}",
  success: "\u2705",
  check: "\u2705",
  done: "\u2705",
  question: "\u2753",
  help: "\u2753",
  faq: "\u2753",
  abstract: "\u{1F4CB}",
  summary: "\u{1F4CB}",
  tldr: "\u{1F4CB}",
  todo: "\u2611\uFE0F",
  failure: "\u274C",
  fail: "\u274C"
};
var LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(\[( |x|X)\]\s+)?(.*)$/;
function listBlock(m, content) {
  const marker = m[2];
  if (m[3] !== void 0) return textBlock("to_do", content, { checked: m[4].toLowerCase() === "x" });
  if (/^\d/.test(marker)) return textBlock("numbered_list_item", content);
  return textBlock("bulleted_list_item", content);
}
function nestList(items) {
  const roots = [];
  const stack = [];
  const childrenOf = (b) => {
    var _a;
    return (_a = b[b.type]).children ?? (_a.children = []);
  };
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
    if (it.embeds.length) {
      if (depth < 2) childrenOf(it.block).push(...it.embeds);
      else childrenOf(parent.block).push(...it.embeds);
    }
  }
  return roots;
}
var EMBED_RE = /!\[\[([^\]|]+)(\|[^\]]*)?\]\]|!\[([^\]]*)\]\(([^)\s]+)\)/g;
function extractEmbeds(text) {
  const embeds = [];
  const parts = text.split(/(`[^`]*`)/);
  const rest = parts.map((part, i) => i % 2 === 1 ? part : replaceEmbeds(part, embeds)).join("");
  return { text: rest.replace(/[ \t]{2,}/g, " ").trim(), embeds };
}
function replaceEmbeds(text, embeds) {
  return text.replace(EMBED_RE, (_all, wiki, _alias, alt, src) => {
    if (wiki) {
      embeds.push(localFile(String(wiki).split("#")[0].trim(), ""));
    } else if (isUrl(src)) {
      embeds.push({
        object: "block",
        type: "image",
        image: { type: "external", external: { url: src }, caption: alt ? parseInline(alt) : [] }
      });
    } else {
      let link = String(src).replace(/^<|>$/g, "");
      try {
        link = decodeURIComponent(link);
      } catch {
      }
      embeds.push(localFile(link, alt ?? ""));
    }
    return " ";
  });
}
function indentWidth(ws) {
  return ws.replace(/\t/g, "    ").length;
}
function splitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim());
}
function markdownToBlocks(md) {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let para = [];
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
    if (!trimmed) {
      flushPara();
      i++;
      continue;
    }
    if (trimmed.startsWith("%%")) {
      flushPara();
      if (!(trimmed.length > 2 && trimmed.endsWith("%%"))) {
        i++;
        while (i < lines.length && !lines[i].includes("%%")) i++;
      }
      i++;
      continue;
    }
    const fence = /^(\s*)(```+|~~~+)\s*([\w#+.-]*)/.exec(line);
    if (fence) {
      flushPara();
      const marker = fence[2];
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) code.push(lines[i++]);
      i++;
      blocks.push(codeBlock(code.join("\n"), fence[3]));
      continue;
    }
    if (trimmed.startsWith("$$")) {
      flushPara();
      let expr;
      if (trimmed.length > 4 && trimmed.endsWith("$$")) {
        expr = trimmed.slice(2, -2);
        i++;
      } else {
        const body = [trimmed.slice(2)];
        i++;
        while (i < lines.length && !lines[i].includes("$$")) body.push(lines[i++]);
        if (i < lines.length) body.push(lines[i].replace("$$", ""));
        i++;
        expr = body.join("\n");
      }
      blocks.push({ object: "block", type: "equation", equation: { expression: expr.trim() } });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (h) {
      flushPara();
      const level = Math.min(h[1].length, 3);
      blocks.push(textBlock(`heading_${level}`, h[2].replace(/\s+#+$/, "")));
      i++;
      continue;
    }
    if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) {
      flushPara();
      blocks.push({ object: "block", type: "divider", divider: {} });
      i++;
      continue;
    }
    if (trimmed.startsWith(">")) {
      flushPara();
      const quote = [];
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
            icon: { type: "emoji", emoji: CALLOUT_EMOJI[kind] ?? "\u{1F4DD}" }
          }
        });
      } else {
        blocks.push(textBlock("quote", quote.join("\n")));
      }
      continue;
    }
    if (trimmed.startsWith("|") && i + 1 < lines.length && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      flushPara();
      const header = splitRow(line);
      const rows = [header];
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
              cells: Array.from({ length: width }, (_, c) => parseInline((r[c] ?? "").replace(/\\\|/g, "|")))
            }
          }))
        }
      });
      continue;
    }
    const li = LIST_RE.exec(line);
    if (li) {
      flushPara();
      const items = [];
      while (i < lines.length) {
        const m = LIST_RE.exec(lines[i]);
        if (m) {
          const { text, embeds } = extractEmbeds(m[5]);
          items.push({ indent: indentWidth(m[1]), block: listBlock(m, text), embeds });
          i++;
        } else if (lines[i].trim() && /^\s+/.test(lines[i]) && items.length) {
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
          image: { type: "external", external: { url: img[2] }, caption: img[1] ? parseInline(img[1]) : [] }
        });
      } else {
        let link = img[2].replace(/^<|>$/g, "");
        try {
          link = decodeURIComponent(link);
        } catch {
        }
        blocks.push(localFile(link, img[1]));
      }
      i++;
      continue;
    }
    para.push(trimmed);
    i++;
  }
  flushPara();
  return blocks;
}

// src/notion.ts
var import_obsidian = require("obsidian");
var API = "https://api.notion.com/v1";
var NOTION_VERSION = "2022-06-28";
var CHUNK = 100;
var NotionError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
};
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function extractId(input) {
  const s = input.trim();
  const dashed = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(s);
  if (dashed) return dashed[0].replace(/-/g, "");
  const path = s.split("?")[0];
  const plain = /[0-9a-f]{32}/i.exec(path);
  return plain ? plain[0] : s;
}
var NotionClient = class {
  constructor(token) {
    this.token = token;
  }
  call(method, path, body) {
    return this.raw(
      method,
      path,
      body === void 0 ? void 0 : JSON.stringify(body),
      body === void 0 ? void 0 : "application/json"
    );
  }
  async raw(method, path, body, contentType, attempt = 0) {
    const headers = {
      Authorization: `Bearer ${this.token}`,
      "Notion-Version": NOTION_VERSION
    };
    if (contentType) headers["Content-Type"] = contentType;
    const res = await (0, import_obsidian.requestUrl)({ url: `${API}${path}`, method, headers, body, throw: false });
    if (res.status === 429 || res.status >= 500) {
      if (attempt < 5) {
        const retry = Number(res.headers?.["retry-after"] ?? res.headers?.["Retry-After"]);
        await sleep((Number.isFinite(retry) && retry > 0 ? retry * 1e3 : 1e3) * (attempt + 1));
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
      }
      throw new NotionError(res.status, code, message);
    }
    return res.json;
  }
  /**
   * Uploads a file with Notion's File Upload API and returns its upload ID,
   * which can then be used in an image/pdf/file block within one hour.
   */
  async uploadFile(filename, contentType, data) {
    const created = await this.call("POST", "/file_uploads", { filename, content_type: contentType });
    const boundary = `----obsidian-to-notion-${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
    const enc = new TextEncoder();
    const safeName = filename.replace(/["\r\n]/g, "_");
    const head = enc.encode(
      `--${boundary}\r
Content-Disposition: form-data; name="file"; filename="${safeName}"\r
Content-Type: ${contentType}\r
\r
`
    );
    const tail = enc.encode(`\r
--${boundary}--\r
`);
    const bytes = new Uint8Array(head.length + data.byteLength + tail.length);
    bytes.set(head, 0);
    bytes.set(new Uint8Array(data), head.length);
    bytes.set(tail, head.length + data.byteLength);
    await this.raw(
      "POST",
      `/file_uploads/${created.id}/send`,
      bytes.buffer,
      `multipart/form-data; boundary=${boundary}`
    );
    return created.id;
  }
  async getDatabase(id) {
    const db = await this.call("GET", `/databases/${id}`);
    const properties = db.properties ?? {};
    const titleProperty = Object.keys(properties).find((k) => properties[k].type === "title") ?? "Name";
    return { titleProperty, properties };
  }
  /**
   * Resolves the upload target. A database gets notes as rows; a plain page
   * gets them as sub-pages (title only, no tag property).
   */
  async getTarget(id) {
    try {
      const db = await this.getDatabase(id);
      return { kind: "database", id, ...db };
    } catch (e) {
      if (e instanceof NotionError && (e.status === 400 || e.status === 404)) {
        try {
          await this.call("GET", `/pages/${id}`);
          return { kind: "page", id, titleProperty: "title", properties: {} };
        } catch {
        }
      }
      throw e;
    }
  }
  async createPage(target, properties, children) {
    const page = await this.call("POST", "/pages", {
      parent: target.kind === "database" ? { database_id: target.id } : { page_id: target.id },
      properties,
      children: children.slice(0, CHUNK)
    });
    await this.appendChildren(page.id, children.slice(CHUNK));
    return page;
  }
  async updatePage(pageId, properties, children) {
    const page = await this.call("PATCH", `/pages/${pageId}`, { properties, archived: false });
    await this.clearChildren(pageId);
    await this.appendChildren(pageId, children);
    return page;
  }
  async appendChildren(blockId, children) {
    for (let i = 0; i < children.length; i += CHUNK) {
      await this.call("PATCH", `/blocks/${blockId}/children`, { children: children.slice(i, i + CHUNK) });
    }
  }
  async clearChildren(blockId) {
    const ids = [];
    let cursor;
    do {
      const q = cursor ? `?page_size=100&start_cursor=${cursor}` : "?page_size=100";
      const res = await this.call("GET", `/blocks/${blockId}/children${q}`);
      for (const b of res.results) ids.push(b.id);
      cursor = res.has_more ? res.next_cursor : void 0;
    } while (cursor);
    for (const id of ids) await this.call("DELETE", `/blocks/${id}`);
  }
};

// src/main.ts
var MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
var MIME = {
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
  pdf: "application/pdf"
};
var DEFAULT_SETTINGS = {
  token: "",
  databaseId: "",
  tagsProperty: "Tags"
};
var FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/;
var ObsidianToNotion = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.busy = /* @__PURE__ */ new Set();
  }
  async onload() {
    await this.loadSettings();
    this.addRibbonIcon("upload-cloud", "\uD604\uC7AC \uB178\uD2B8\uB97C Notion\uC5D0 \uC62C\uB9AC\uAE30", () => {
      const file = this.app.workspace.getActiveFile();
      if (file) this.upload(file);
      else new import_obsidian2.Notice("\uC5F4\uB824 \uC788\uB294 \uB178\uD2B8\uAC00 \uC5C6\uC5B4\uC694.");
    });
    this.addCommand({
      id: "upload-current-note",
      name: "\uD604\uC7AC \uB178\uD2B8\uB97C Notion\uC5D0 \uC62C\uB9AC\uAE30",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) this.upload(file);
        return true;
      }
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof import_obsidian2.TFile) || file.extension !== "md") return;
        menu.addItem(
          (item) => item.setTitle("Notion\uC73C\uB85C \uBCF4\uB0B4\uAE30").setIcon("upload-cloud").onClick(() => this.upload(file))
        );
      })
    );
    this.addSettingTab(new NotionSettingTab(this.app, this));
  }
  async upload(file) {
    const { token, databaseId: rawDb, tagsProperty } = this.settings;
    if (!token || !rawDb) {
      new import_obsidian2.Notice("\uC124\uC815 \u2192 Obsidian to Notion\uC5D0\uC11C \uD1A0\uD070\uACFC \uB370\uC774\uD130\uBCA0\uC774\uC2A4 ID\uB97C \uBA3C\uC800 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
      return;
    }
    if (this.busy.has(file.path)) return;
    this.busy.add(file.path);
    const progress = new import_obsidian2.Notice(`Notion\uC5D0 \uC62C\uB9AC\uB294 \uC911\u2026 (${file.basename})`, 0);
    try {
      const client = new NotionClient(token);
      const db = await client.getTarget(extractId(rawDb));
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      const raw = await this.app.vault.read(file);
      const body = raw.replace(FRONTMATTER_RE, "");
      const blocks = markdownToBlocks(body);
      const attach = await this.resolveAttachments(client, file, blocks, progress);
      const title = typeof fm.title === "string" && fm.title.trim() ? fm.title.trim() : file.basename;
      const properties = {
        [db.titleProperty]: { title: [{ type: "text", text: { content: title.slice(0, 2e3) } }] }
      };
      if (tagsProperty && db.properties[tagsProperty]?.type === "multi_select") {
        const tags = ((0, import_obsidian2.parseFrontMatterTags)(fm) ?? []).map((t) => t.replace(/^#/, "").replace(/,/g, " ").trim()).filter(Boolean);
        properties[tagsProperty] = { multi_select: [...new Set(tags)].map((name) => ({ name: name.slice(0, 100) })) };
      }
      const existingId = typeof fm.notion_id === "string" ? fm.notion_id : void 0;
      let page;
      let updated = false;
      if (existingId) {
        try {
          page = await client.updatePage(existingId, properties, blocks);
          updated = true;
        } catch (e) {
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
      new import_obsidian2.Notice(updated ? `\u2705 Notion \uD398\uC774\uC9C0\uB97C \uC5C5\uB370\uC774\uD2B8\uD588\uC5B4\uC694: ${title}` : `\u2705 Notion\uC5D0 \uC0C8 \uD398\uC774\uC9C0\uB97C \uB9CC\uB4E4\uC5C8\uC5B4\uC694: ${title}`);
      if (attach.failed.length) {
        new import_obsidian2.Notice(`\u26A0\uFE0F \uCCA8\uBD80\uD30C\uC77C ${attach.failed.length}\uAC1C\uB294 \uC62C\uB9AC\uC9C0 \uBABB\uD588\uC5B4\uC694:
${attach.failed.join("\n")}`, 12e3);
      }
    } catch (e) {
      progress.hide();
      console.error("[obsidian-to-notion]", e);
      new import_obsidian2.Notice(`\u274C Notion \uC5C5\uB85C\uB4DC \uC2E4\uD328: ${explain(e)}`, 1e4);
    } finally {
      this.busy.delete(file.path);
    }
  }
  /**
   * Replaces local-file placeholder blocks with uploaded Notion image/PDF blocks.
   * Anything that can't be uploaded becomes a short text line instead.
   */
  async resolveAttachments(client, note, blocks, progress) {
    const failed = [];
    const cache = /* @__PURE__ */ new Map();
    const targets = [];
    const walk = (list) => list.forEach((b, idx) => {
      if (b.type === LOCAL_FILE) targets.push({ list, idx, b });
      else if (Array.isArray(b[b.type]?.children)) walk(b[b.type].children);
    });
    walk(blocks);
    let n = 0;
    for (const { list, idx, b } of targets) {
      const blocks2 = list;
      const { link, caption } = b[LOCAL_FILE];
      const fallback = (reason) => {
        failed.push(`${link} (${reason})`);
        blocks2[idx] = {
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: [{ type: "text", text: { content: `\u{1F4CE} \uCCA8\uBD80: ${link}` } }] }
        };
      };
      const att = this.app.metadataCache.getFirstLinkpathDest(link, note.path);
      if (!att) {
        fallback("\uBCF4\uAD00\uD568\uC5D0\uC11C \uCC3E\uC744 \uC218 \uC5C6\uC74C");
        continue;
      }
      const ext = att.extension.toLowerCase();
      const contentType = MIME[ext];
      if (!contentType) {
        fallback(`\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uD615\uC2DD .${ext}`);
        continue;
      }
      if (att.stat.size > MAX_UPLOAD_BYTES) {
        fallback(`${(att.stat.size / 1024 / 1024).toFixed(1)}MB, 20MB \uCD08\uACFC`);
        continue;
      }
      n++;
      progress.setMessage(`Notion\uC5D0 \uC62C\uB9AC\uB294 \uC911\u2026 \uCCA8\uBD80\uD30C\uC77C ${n}/${targets.length}`);
      try {
        let id = cache.get(att.path);
        if (!id) {
          id = await client.uploadFile(att.name, contentType, await this.app.vault.readBinary(att));
          cache.set(att.path, id);
        }
        const kind = ext === "pdf" ? "pdf" : "image";
        const cap = caption || "";
        blocks2[idx] = {
          object: "block",
          type: kind,
          [kind]: {
            type: "file_upload",
            file_upload: { id },
            caption: cap ? [{ type: "text", text: { content: cap.slice(0, 2e3) } }] : []
          }
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
};
function explain(e) {
  if (e instanceof NotionError) {
    if (e.status === 401) return "\uD1A0\uD070\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC544\uC694. \uC124\uC815\uC5D0\uC11C \uD1A0\uD070\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.";
    if (e.status === 404 || e.code === "object_not_found")
      return "\uB370\uC774\uD130\uBCA0\uC774\uC2A4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC5B4\uC694. ID\uB97C \uD655\uC778\uD558\uACE0, \uB370\uC774\uD130\uBCA0\uC774\uC2A4\uC5D0 Integration\uC744 \uC5F0\uACB0\uD588\uB294\uC9C0 \uD655\uC778\uD574 \uC8FC\uC138\uC694.";
    if (e.code === "validation_error") return `\uB178\uC158\uC774 \uB0B4\uC6A9\uC744 \uAC70\uBD80\uD588\uC5B4\uC694: ${e.message}`;
    return `${e.message} (${e.status})`;
  }
  return e instanceof Error ? e.message : String(e);
}
var NotionSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian2.Setting(containerEl).setName("Notion Integration \uD1A0\uD070").setDesc("notion.so/profile/integrations \uC5D0\uC11C \uB9CC\uB4E0 \uB0B4\uBD80 Integration\uC758 \uC2DC\uD06C\uB9BF \uD1A0\uD070").addText((t) => {
      t.inputEl.type = "password";
      t.setPlaceholder("ntn_...").setValue(this.plugin.settings.token).onChange(async (v) => {
        this.plugin.settings.token = v.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("\uB370\uC774\uD130\uBCA0\uC774\uC2A4 \uB610\uB294 \uD398\uC774\uC9C0 \uB9C1\uD06C").setDesc("\uB178\uD2B8\uB97C \uC62C\uB9B4 Notion \uB370\uC774\uD130\uBCA0\uC774\uC2A4(\uB610\uB294 \uC77C\uBC18 \uD398\uC774\uC9C0)\uC758 \uB9C1\uD06C\uB098 ID").addText(
      (t) => t.setPlaceholder("https://www.notion.so/...").setValue(this.plugin.settings.databaseId).onChange(async (v) => {
        this.plugin.settings.databaseId = v.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\uD0DC\uADF8 \uC18D\uC131 \uC774\uB984").setDesc("frontmatter\uC758 tags\uB97C \uB123\uC744 Multi-select \uC18D\uC131 \uC774\uB984. \uB370\uC774\uD130\uBCA0\uC774\uC2A4\uC5D0 \uC5C6\uC73C\uBA74 \uAC74\uB108\uB6F0\uC5B4\uC694.").addText(
      (t) => t.setValue(this.plugin.settings.tagsProperty).onChange(async (v) => {
        this.plugin.settings.tagsProperty = v.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\uC5F0\uACB0 \uD14C\uC2A4\uD2B8").setDesc("\uD1A0\uD070\uACFC \uB370\uC774\uD130\uBCA0\uC774\uC2A4 \uC124\uC815\uC774 \uB9DE\uB294\uC9C0 \uD655\uC778\uD574\uC694.").addButton(
      (b) => b.setButtonText("\uD14C\uC2A4\uD2B8").onClick(async () => {
        try {
          const db = await new NotionClient(this.plugin.settings.token).getTarget(
            extractId(this.plugin.settings.databaseId)
          );
          if (db.kind === "page") {
            new import_obsidian2.Notice("\u2705 \uC5F0\uACB0 \uC131\uACF5! \uC77C\uBC18 \uD398\uC774\uC9C0\uB77C\uC11C \uB178\uD2B8\uAC00 \uC774 \uD398\uC774\uC9C0\uC758 \uD558\uC704 \uD398\uC774\uC9C0\uB85C \uC62C\uB77C\uAC00\uC694. (\uD0DC\uADF8\uB294 \uB370\uC774\uD130\uBCA0\uC774\uC2A4\uC5D0\uC11C\uB9CC \uC9C0\uC6D0)");
            return;
          }
          const tagProp = this.plugin.settings.tagsProperty;
          const tagOk = db.properties[tagProp]?.type === "multi_select";
          new import_obsidian2.Notice(
            `\u2705 \uC5F0\uACB0 \uC131\uACF5! \uC81C\uBAA9 \uC18D\uC131: "${db.titleProperty}"` + (tagProp ? tagOk ? `, \uD0DC\uADF8 \uC18D\uC131: "${tagProp}"` : ` (\uD0DC\uADF8 \uC18D\uC131 "${tagProp}"\uC740 \uC5C6\uC5B4\uC11C \uAC74\uB108\uB6F0\uC5B4\uC694)` : "")
          );
        } catch (e) {
          new import_obsidian2.Notice(`\u274C \uC5F0\uACB0 \uC2E4\uD328: ${explain(e)}`, 1e4);
        }
      })
    );
  }
};
