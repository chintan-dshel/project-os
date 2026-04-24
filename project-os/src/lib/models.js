export const MODELS = {
  HAIKU:  'claude-haiku-4-5-20251001',
  SONNET: 'claude-sonnet-4-20250514',
  OPUS:   'claude-opus-4-7-20251101',
};

export const FALLBACK_CHAINS = {
  [MODELS.HAIKU]:  [MODELS.HAIKU,  MODELS.SONNET],
  [MODELS.SONNET]: [MODELS.SONNET, MODELS.OPUS],
  [MODELS.OPUS]:   [MODELS.OPUS],
};
