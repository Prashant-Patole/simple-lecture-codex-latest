import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";
import { convertMathpixToStandard } from "@/components/learning/player/utils/latexNormalizer";
import { cn } from "@/lib/utils";

interface DoubtsMarkdownProps {
  content: string;
  variant?: "user" | "assistant";
  inline?: boolean;
  className?: string;
}

/**
 * Unified markdown + KaTeX renderer for Doubts chat.
 * Mirrors the Notes pipeline (ContentRenderer) so math/LaTeX renders
 * identically across the app.
 */
export function DoubtsMarkdown({
  content,
  variant = "assistant",
  inline = false,
  className,
}: DoubtsMarkdownProps) {
  const normalized = convertMathpixToStandard(content || "");

  const inlineComponents = {
    p: ({ children }: any) => <span>{children}</span>,
    img: () => null,
  };

  const blockComponents = {
    h1: ({ children }: any) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-base font-semibold mb-2">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-sm font-semibold mb-1.5">{children}</h3>,
    p: ({ children }: any) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
    ul: ({ children }: any) => (
      <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal list-inside space-y-1 mb-2">{children}</ol>
    ),
    li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
    code: ({ className: cls, children }: any) => {
      const isInline = !cls;
      return isInline ? (
        <code className="px-1 py-0.5 bg-black/10 dark:bg-white/10 rounded text-xs font-mono">
          {children}
        </code>
      ) : (
        <code className="block p-2 bg-black/10 dark:bg-white/10 rounded text-xs font-mono overflow-x-auto my-2">
          {children}
        </code>
      );
    },
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-2 border-current/40 pl-3 italic opacity-90 my-2">
        {children}
      </blockquote>
    ),
    strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
    img: ({ alt, ...imgProps }: any) => (
      <img {...imgProps} alt={alt || ""} className="max-w-full h-auto rounded-md my-2 block" />
    ),
  };

  return (
    <div
      className={cn(
        "max-w-none",
        !inline &&
          "overflow-x-auto [&_.katex-display]:my-2 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:max-w-full",
        inline && "inline [&>*]:inline [&_.katex-display]:!my-0 [&_.katex-display]:inline [&_.katex]:whitespace-normal",
        variant === "user" && "text-primary-foreground",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={inline ? inlineComponents : blockComponents}
      >
        {inline ? normalized.replace(/\s*\n+\s*/g, " ") : normalized}
      </ReactMarkdown>
    </div>
  );
}
