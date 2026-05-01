import DOMPurify from "isomorphic-dompurify";

export interface SanitizeOptions {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  allowStyles?: boolean;
  allowDataUrls?: boolean;
  removeComments?: boolean;
}

export interface SecurityCheckResult {
  isSafe: boolean;
  issues: SecurityIssue[];
  sanitizedContent?: string;
  score: number;
}

export interface SecurityIssue {
  type:
    | "xss"
    | "css_injection"
    | "script_injection"
    | "dangerous_tag"
    | "dangerous_attribute"
    | "malformed_html";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  position?: { line: number; column: number };
}

const DEFAULT_ALLOWED_TAGS = [
  "div",
  "span",
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "del",
  "ins",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "blockquote",
  "code",
  "pre",
  "kbd",
  "samp",
  "a",
  "img",
  "picture",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "col",
  "colgroup",
  "ruby",
  "rt",
  "rp",
  "rb",
  "small",
  "sub",
  "sup",
];

const DEFAULT_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "title", "target"],
  img: ["src", "alt", "title", "width", "height", "loading"],
  picture: ["srcset", "sizes"],
  "*": ["class", "id", "data-start", "data-end", "data-id"],
};

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;",
};

export function checkSecurity(content: string, options: SanitizeOptions = {}): SecurityCheckResult {
  if (!content || typeof content !== "string") {
    return { isSafe: true, issues: [], score: 100 };
  }

  const sanitized = sanitizeHtml(content, options);
  const isSafe = sanitized === content;

  const issues: SecurityIssue[] = [];
  if (!isSafe) {
    issues.push({
      type: "xss",
      severity: "high",
      description: "Content was modified during sanitization",
    });
  }

  return {
    isSafe,
    issues,
    sanitizedContent: isSafe ? undefined : sanitized,
    score: isSafe ? 100 : 60,
  };
}

export function sanitizeHtml(content: string, options: SanitizeOptions = {}): string {
  if (!content || typeof content !== "string") {
    return content || "";
  }

  const allowedTags = options.allowedTags || DEFAULT_ALLOWED_TAGS;
  const allowedAttributes = options.allowedAttributes || DEFAULT_ALLOWED_ATTRIBUTES;

  const attrList: string[] = [];
  for (const [tag, attrs] of Object.entries(allowedAttributes)) {
    for (const attr of attrs) {
      attrList.push(tag === "*" ? attr : `${tag} ${attr}`);
    }
  }

  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: attrList,
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ["style", "script", "iframe", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });
}

export function sanitizeText(content: string): string {
  if (!content || typeof content !== "string") {
    return content || "";
  }

  return DOMPurify.sanitize(content, { ALLOWED_TAGS: [] });
}

export function setElementContent(
  element: HTMLElement,
  content: string,
  options: SanitizeOptions = {},
): void {
  const securityCheck = checkSecurity(content, options);
  element.textContent = securityCheck.isSafe ? content : sanitizeHtml(content, options);
}

export function createSafeElement(
  tagName: string,
  content: string,
  attributes: Record<string, string> = {},
  options: SanitizeOptions = {},
): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const element = document.createElement(tagName);

  Object.entries(attributes).forEach(([key, value]) => {
    if (isSafeAttribute(key, value)) {
      element.setAttribute(key, value);
    }
  });

  setElementContent(element, content, options);
  return element;
}

export function isSafeAttribute(name: string, value: string): boolean {
  const lcName = name.toLowerCase();
  const lcValue = value.toLowerCase();

  if (lcName.startsWith("on")) return false;
  if (lcValue.includes("javascript:")) return false;
  if (lcValue.includes("data:") && name !== "src") return false;

  return true;
}

export function encodeHtmlEntities(text: string): string {
  return text.replace(/[&<>"'/]/g, (char) => HTML_ENTITIES[char] || char);
}

export function decodeHtmlEntities(text: string): string {
  if (typeof document === "undefined") {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
  }
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

export function createSafeSubtitleElement(
  content: string,
  attributes: Record<string, string> = {},
): HTMLElement | null {
  const subtitleOptions: SanitizeOptions = {
    allowedTags: ["div", "span", "small", "ruby", "rt", "rp", "rb", "br"],
    allowedAttributes: {
      div: ["class", "data-start", "data-end", "data-id"],
      span: ["class"],
      small: ["class"],
      ruby: ["class"],
      rt: ["class"],
      rp: ["class"],
      rb: ["class"],
      br: ["class"],
    },
    allowStyles: false,
    allowDataUrls: false,
    removeComments: true,
  };

  return createSafeElement("div", content, attributes, subtitleOptions);
}

export function renderSafeFurigana(text: string, furigana: string): string {
  if (!furigana?.trim()) {
    return encodeHtmlEntities(text);
  }

  try {
    const furiganaRegex = /([^\s()]+)\(([^)]+)\)/g;
    let result = text;

    result = result.replace(furiganaRegex, (_match, word, reading) => {
      return `<ruby>${encodeHtmlEntities(word)}<rt>${encodeHtmlEntities(reading)}</rt></ruby>`;
    });

    return sanitizeHtml(result, {
      allowedTags: ["ruby", "rt"],
      allowedAttributes: { ruby: [], rt: [] },
    });
  } catch {
    return encodeHtmlEntities(text);
  }
}
