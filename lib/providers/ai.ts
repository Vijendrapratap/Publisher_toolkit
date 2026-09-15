// The AI Gateway authenticates with an API key or a Vercel OIDC token.
export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN)
}
