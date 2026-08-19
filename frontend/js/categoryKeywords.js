/**
 * categoryKeywords.js — Centralized Category Keyword Dictionary
 * Supports English and Tamil keywords and phrase variations for Makkal Kural issue categories.
 * Completely offline and 100% rule-based.
 */

export const CATEGORY_KEYWORDS = {
  Waste: {
    key: 'Waste',
    label: 'Waste',
    emoji: '🗑️',
    keywords: [
      // English keywords & phrases
      'garbage',
      'waste',
      'trash',
      'litter',
      'dump',
      'dumping',
      'rubbish',
      'refuse',
      'dirt',
      'bin',
      'dustbin',
      'smell',
      'stench',
      'cleanup',
      'overflowing bin',
      'garbage pile',
      'waste pile',
      'dirty street',
      'garbage truck',
      // Tamil keywords & phrases
      'குப்பை',
      'கழிவு',
      'குப்பைகள்',
      'குப்பை கொட்டுதல்',
      'துர்நாற்றம்',
      'சாக்கடை குப்பை',
      'கழிவுகள்',
      'கழிவு நீர்',
      'குப்பை தொட்டி',
      'குப்பை குவியல்',
      'சுத்தம் செய்யவில்லை'
    ]
  },

  Water: {
    key: 'Water',
    label: 'Water',
    emoji: '💧',
    keywords: [
      // English keywords & phrases
      'water',
      'leak',
      'leakage',
      'pipeline',
      'pipe',
      'drain',
      'sewage',
      'flooded',
      'flooding',
      'overflow',
      'overflowing',
      'tap',
      'water supply',
      'drinking water',
      'contamination',
      'drainage',
      'water pipe',
      'water stagnation',
      'broken pipe',
      // Tamil keywords & phrases
      'தண்ணீர்',
      'குடிநீர்',
      'குழாய்',
      'கசிவு',
      'சாக்கடை',
      'நீர்',
      'வெள்ளம்',
      'நீர் கசிவு',
      'குடிநீர் பிரச்சனை',
      'தண்ணீர் வரவில்லை',
      'தண்ணீர் கசிவு',
      'சாக்கடை நீர்',
      'குழாய் உடைப்பு',
      'நீர் தேக்கம்'
    ]
  },

  Electricity: {
    key: 'Electricity',
    label: 'Electrical',
    emoji: '⚡',
    keywords: [
      // English keywords & phrases
      'street light',
      'light',
      'lights',
      'electricity',
      'electric',
      'electrical',
      'power',
      'powercut',
      'power cut',
      'pole',
      'wire',
      'wires',
      'transformer',
      'voltage',
      'spark',
      'blackout',
      'streetlight',
      'streetlights',
      'electric pole',
      'hanging wire',
      'eb',
      'tneb',
      // Tamil keywords & phrases
      'மின்சாரம்',
      'மின்கம்பம்',
      'விளக்கு',
      'தெருவிளக்கு',
      'தெரு விளக்கு',
      'மின்கம்பி',
      'கரண்ட்',
      'மின்வெட்டு',
      'மின் கம்பம்',
      'மின் கசிவு',
      'தெரு விளக்குகள்',
      'மின்மாற்றி',
      'மின்சாரம் இல்லை',
      'விளக்கு எரியவில்லை'
    ]
  },

  Roads: {
    key: 'Roads',
    label: 'Road',
    emoji: '🛣️',
    keywords: [
      // English keywords & phrases
      'pothole',
      'potholes',
      'road',
      'roads',
      'damaged road',
      'broken road',
      'street',
      'footpath',
      'pavement',
      'tar road',
      'asphalt',
      'crack',
      'crater',
      'speed breaker',
      'road damage',
      'road repair',
      'bad road',
      // Tamil keywords & phrases
      'சாலை',
      'சாலையில்',
      'பள்ளம்',
      'சாலை பள்ளம்',
      'நடைபாதை',
      'தெரு',
      'தார் சாலை',
      'பழுது',
      'சேதமடைந்த சாலை',
      'சாலை பழுது',
      'பள்ளங்கள்'
    ]
  },

  'Law & Order': {
    key: 'Law & Order',
    label: 'Law & Order',
    emoji: '👮',
    keywords: [
      // English keywords & phrases
      'illegal',
      'encroachment',
      'crime',
      'theft',
      'violence',
      'public nuisance',
      'blocking',
      'nuisance',
      'harassment',
      'gambling',
      'alcohol',
      'unauthorized',
      'brawl',
      'illegal construction',
      'unauthorized shop',
      'road block',
      'encroached',
      // Tamil keywords & phrases
      'ஆக்கிரமிப்பு',
      'சட்டவிரோத',
      'திருட்டு',
      'தகராறு',
      'பொது இடையூறு',
      'அக்கிரமம்',
      'வழி மறிப்பு',
      'சட்டவிரோத செயல்',
      'அக்கிரம ஆக்கிரமிப்பு',
      'சாலை ஆக்கிரமிப்பு'
    ]
  }
};
