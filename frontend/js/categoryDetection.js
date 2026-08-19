/**
 * categoryDetection.js — Local Rule-Based Category Detection Engine
 * 100% Client-side, rule-based keyword matching algorithm.
 * Supports English & Tamil. Completely offline without any AI/LLM APIs.
 */

import { CATEGORY_KEYWORDS } from './categoryKeywords.js';

/**
 * Normalizes input text for keyword searching while preserving Tamil characters
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects category from description text using weighted rule-based keyword matching.
 * @param {string} description
 * @returns {{
 *   status: 'SUCCESS' | 'EMPTY' | 'NO_MATCH',
 *   category: string | null,
 *   label: string | null,
 *   emoji: string | null,
 *   confidenceScore: number,
 *   isAmbiguous: boolean,
 *   scores: Record<string, number>,
 *   matchedKeywords: string[],
 *   secondCategory?: { key: string, label: string, emoji: string }
 * }}
 */
export function detectCategory(description) {
  const trimmed = description ? description.trim() : '';

  // Requirement 8: Empty or too short description (<4 chars)
  if (!trimmed || trimmed.length < 4) {
    return {
      status: 'EMPTY',
      category: null,
      label: null,
      emoji: null,
      confidenceScore: 0,
      isAmbiguous: false,
      scores: {},
      matchedKeywords: []
    };
  }

  const normalized = normalizeText(trimmed);

  const scores = {};
  const matchedKeywordsMap = {};

  // Calculate score for each category
  Object.keys(CATEGORY_KEYWORDS).forEach(catKey => {
    const categoryDef = CATEGORY_KEYWORDS[catKey];
    scores[catKey] = 0;
    matchedKeywordsMap[catKey] = [];

    categoryDef.keywords.forEach(kw => {
      const normKw = normalizeText(kw);
      if (!normKw) return;

      // Determine match weight: multi-word phrases get higher weight (3), single words get 1
      const isMultiWord = normKw.includes(' ');
      const weight = isMultiWord ? 3 : 1;

      // Search normalized keyword in normalized text
      if (normalized.includes(normKw)) {
        scores[catKey] += weight;
        matchedKeywordsMap[catKey].push(kw);
      }
    });
  });

  // Sort categories by score descending
  const sortedCategories = Object.keys(scores)
    .map(key => ({
      key,
      label: CATEGORY_KEYWORDS[key].label,
      emoji: CATEGORY_KEYWORDS[key].emoji,
      score: scores[key],
      matchedKeywords: matchedKeywordsMap[key]
    }))
    .sort((a, b) => b.score - a.score);

  const top = sortedCategories[0];
  const second = sortedCategories[1];

  // Requirement 9: No match found
  if (!top || top.score === 0) {
    return {
      status: 'NO_MATCH',
      category: null,
      label: null,
      emoji: null,
      confidenceScore: 0,
      isAmbiguous: false,
      scores,
      matchedKeywords: []
    };
  }

  // Requirement 6: Handle Multiple Matches & Ambiguity
  // Ambiguous if top two categories both have matching keywords
  let isAmbiguous = false;
  let secondCategory = null;

  if (second && second.score > 0) {
    const diff = top.score - second.score;
    const ratio = second.score / top.score;
    if (diff <= 2 || ratio >= 0.2) {
      isAmbiguous = true;
      secondCategory = {
        key: second.key,
        label: second.label,
        emoji: second.emoji
      };
    }
  }

  return {
    status: 'SUCCESS',
    category: top.key,
    label: top.label,
    emoji: top.emoji,
    confidenceScore: top.score,
    isAmbiguous,
    scores,
    matchedKeywords: top.matchedKeywords,
    secondCategory
  };
}
