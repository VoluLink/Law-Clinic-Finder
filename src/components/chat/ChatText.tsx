type ChatTextProps = { children: string };

const BOLD_MARKER = /\*\*([\s\S]+?)\*\*/g;

/** Renders the one Markdown feature used in assistant prose without accepting HTML. */
export function ChatText({ children }: ChatTextProps) {
  return children
    .split(BOLD_MARKER)
    .map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part));
}
