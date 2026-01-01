/**
 * TextWithTerms Component
 *
 * Renders text with glossary terms highlighted and clickable.
 * Scans text for known terms and wraps them in interactive elements.
 */

import React, { useMemo } from 'react';
import { GlossaryTerm, TextWithTermsProps } from '../types';
import { getGlossaryWords, findTermByWord } from '../data/terms';
import './DictionaryPanel.css';

interface TextSegment {
  type: 'text' | 'term';
  content: string;
  term?: GlossaryTerm;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse text and identify glossary terms
 */
function parseTextWithTerms(text: string): TextSegment[] {
  const glossaryWords = getGlossaryWords();

  if (glossaryWords.length === 0) {
    return [{ type: 'text', content: text }];
  }

  // Sort by length (longest first) to match longer terms before shorter ones
  // e.g., "Certificate of Occupancy" before "Certificate"
  const sortedWords = [...glossaryWords].sort((a, b) => b.length - a.length);

  // Build regex pattern with word boundaries
  // This ensures we match whole words only
  const pattern = sortedWords
    .map(word => `\\b${escapeRegex(word)}\\b`)
    .join('|');

  const regex = new RegExp(`(${pattern})`, 'gi');

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  // Find all matches
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }

    // Add the matched term
    const matchedWord = match[0];
    const term = findTermByWord(matchedWord);

    if (term) {
      segments.push({
        type: 'term',
        content: matchedWord,
        term
      });
    } else {
      // Fallback: if term not found, treat as regular text
      segments.push({
        type: 'text',
        content: matchedWord
      });
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }

  return segments;
}

export function TextWithTerms({
  text,
  onTermClick,
  className,
  style
}: TextWithTermsProps): JSX.Element {
  const segments = useMemo(() => parseTextWithTerms(text), [text]);

  const handleTermClick = (term: GlossaryTerm, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onTermClick?.(term);
  };

  return (
    <span className={className} style={style}>
      {segments.map((segment, index) => {
        if (segment.type === 'term' && segment.term) {
          return (
            <span
              key={index}
              className="dictionary-term-link"
              onClick={(e) => handleTermClick(segment.term!, e)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onTermClick?.(segment.term!);
                }
              }}
              title={`Click to learn about: ${segment.term.term}`}
            >
              {segment.content}
            </span>
          );
        }
        return <React.Fragment key={index}>{segment.content}</React.Fragment>;
      })}
    </span>
  );
}
