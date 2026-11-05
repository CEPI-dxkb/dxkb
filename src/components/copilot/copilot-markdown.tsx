"use client";

import { ChevronDown, ChevronUp, ImageIcon } from "lucide-react";
import { memo, useState, type ComponentProps } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Code blocks longer than this many lines start collapsed (as on BV-BRC). */
const collapsedCodeLines = 8;

function CodeBlock({ children, ...props }: ComponentProps<"pre">) {
  const [expanded, setExpanded] = useState(false);
  const source = blockText(children);
  const lines = source.split("\n").length;
  const collapsible = lines > collapsedCodeLines;
  return (
    <div className="my-2 overflow-hidden rounded-md border bg-muted">
      <pre
        {...props}
        className={
          collapsible && !expanded
            ? "max-h-40 overflow-hidden p-3 font-mono text-xs leading-relaxed"
            : "overflow-x-auto p-3 font-mono text-xs leading-relaxed"
        }
      >
        {children}
      </pre>
      {collapsible && (
        <div className="border-t px-2 py-1">
          <Button
            variant="ghost"
            size="xs"
            aria-expanded={expanded}
            onClick={() => {
              setExpanded((value) => !value);
            }}
          >
            {expanded ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
            {expanded ? "Show less" : `Show all ${String(lines)} lines`}
          </Button>
        </div>
      )}
    </div>
  );
}

/** The text inside a rendered `<pre>`'s `<code>` child, for line counting. */
function blockText(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(blockText).join("");
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    return blockText(props?.children);
  }
  return "";
}

/**
 * Element overrides. Links open in a new tab (agent answers link to BV-BRC
 * pages for now). Images are never loaded: a model-written image URL could
 * carry chat content to another server, so it is shown as a link instead.
 */
const components: Components = {
  p: ({ node: _node, ...props }) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
  a: ({ node: _node, href, children, ...props }) => (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="wrap-break-word text-link underline underline-offset-2 dark:hover:text-foreground"
    >
      {children}
    </a>
  ),
  img: ({ src, alt }) => {
    const url = typeof src === "string" ? src : null;
    const label = alt?.trim() || "image";
    return url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-link underline underline-offset-2 dark:hover:text-foreground"
      >
        <ImageIcon className="size-3.5" aria-hidden />
        {label}
      </a>
    ) : (
      <span>[{label}]</span>
    );
  },
  ul: ({ node: _node, ...props }) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
  ol: ({ node: _node, ...props }) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
  li: ({ node: _node, ...props }) => <li className="pl-0.5" {...props} />,
  h1: ({ node: _node, ...props }) => <h3 className="mt-4 mb-2 text-base font-semibold" {...props} />,
  h2: ({ node: _node, ...props }) => <h4 className="mt-4 mb-2 text-sm font-semibold" {...props} />,
  h3: ({ node: _node, ...props }) => <h5 className="mt-3 mb-1 text-sm font-semibold" {...props} />,
  h4: ({ node: _node, ...props }) => <h6 className="mt-3 mb-1 text-sm font-medium" {...props} />,
  blockquote: ({ node: _node, ...props }) => (
    <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground" {...props} />
  ),
  hr: () => <hr className="my-3 border-border" />,
  pre: ({ node: _node, ...props }) => <CodeBlock {...props} />,
  code: ({ node: _node, className, ...props }) =>
    // Fenced code carries a `language-*` class and sits in CodeBlock's <pre>.
    className ? (
      <code className={className} {...props} />
    ) : (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs" {...props} />
    ),
  table: ({ node: _node, ...props }) => (
    <div className="my-2 overflow-x-auto rounded-md border">
      <Table {...props} />
    </div>
  ),
  thead: ({ node: _node, ...props }) => <TableHeader {...props} />,
  tbody: ({ node: _node, ...props }) => <TableBody {...props} />,
  tr: ({ node: _node, ...props }) => <TableRow {...props} />,
  th: ({ node: _node, ...props }) => <TableHead {...props} />,
  td: ({ node: _node, ...props }) => <TableCell {...props} />,
};

/**
 * An answer's markdown (GitHub flavor: tables, task lists, strikethrough).
 * Raw HTML in the text is shown as text, never rendered.
 */
export const CopilotMarkdown = memo(function CopilotMarkdown({
  content,
}: {
  content: string;
}) {
  return (
    <div className="text-sm leading-relaxed wrap-break-word">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
});
