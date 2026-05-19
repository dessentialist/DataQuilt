/**
 * MessageWithLinks Component
 *
 * Renders a message string that may contain markdown-style links in the format [text](url).
 * Links are rendered as clickable React Router links for internal routes, or anchor tags for external URLs.
 *
 * Usage:
 *   <MessageWithLinks message="Check your API key in [Settings](/settings)." />
 */

import { Link } from "wouter";

interface MessageWithLinksProps {
  /**
   * Message text that may contain markdown-style links [text](url)
   */
  message: string;

  /**
   * Additional CSS classes to apply to the container
   */
  className?: string;
}

/**
 * Parse markdown-style links [text](url) from a message string
 * Returns an array of text segments and link objects
 */
function parseMessageWithLinks(message: string): Array<{ type: "text" | "link"; content: string; href?: string }> {
  const parts: Array<{ type: "text" | "link"; content: string; href?: string }> = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(message)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: message.substring(lastIndex, match.index),
      });
    }

    // Add the link
    parts.push({
      type: "link",
      content: match[1], // Link text
      href: match[2], // Link URL
    });

    lastIndex = linkRegex.lastIndex;
  }

  // Add remaining text after the last link
  if (lastIndex < message.length) {
    parts.push({
      type: "text",
      content: message.substring(lastIndex),
    });
  }

  // If no links were found, ensure we return at least the entire message as text
  if (parts.length === 0) {
    parts.push({
      type: "text",
      content: message,
    });
  }

  return parts;
}

/**
 * Check if a URL is external (starts with http:// or https://)
 */
function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function MessageWithLinks({ message, className = "" }: MessageWithLinksProps) {
  const parts = parseMessageWithLinks(message);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === "text") {
          return <span key={index}>{part.content}</span>;
        }

        // Render link
        const href = part.href!;
        const isExternal = isExternalUrl(href);

        if (isExternal) {
          // External link - use anchor tag with target="_blank"
          return (
            <a
              key={index}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline font-medium"
            >
              {part.content}
            </a>
          );
        } else {
          // Internal link - use wouter Link component
          return (
            <Link
              key={index}
              href={href}
              className="text-blue-600 hover:text-blue-800 underline font-medium"
            >
              {part.content}
            </Link>
          );
        }
      })}
    </span>
  );
}

