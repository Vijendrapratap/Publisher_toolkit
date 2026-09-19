import { NextResponse } from 'next/server'
import { isAiConfigured } from '@/lib/providers/ai'
import fs from 'node:fs'
import path from 'node:path'

export async function GET() {
  const configured = isAiConfigured()
  const rawKey = process.env.OPENROUTER_API_KEY || ''
  const maskedKey = rawKey.length > 8 ? `${rawKey.slice(0, 7)}...${rawKey.slice(-4)}` : configured ? '••••••••' : null
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-5'

  return NextResponse.json({
    isConfigured: configured,
    model,
    maskedKey,
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { apiKey, model, testOnly } = body

  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return NextResponse.json({ error: 'OpenRouter API key is required' }, { status: 400 })
  }

  const cleanKey = apiKey.trim()
  const cleanModel = typeof model === 'string' && model.trim() ? model.trim() : 'anthropic/claude-sonnet-5'

  // Validate the key with OpenRouter API
  try {
    const checkRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${cleanKey}` },
    })
    if (!checkRes.ok) {
      const errJson = await checkRes.json().catch(() => ({}))
      const msg = errJson?.error?.message || `OpenRouter returned HTTP ${checkRes.status}`
      return NextResponse.json({ error: `Invalid OpenRouter Key: ${msg}` }, { status: 400 })
    }
  } catch (err: any) {
    // If offline or network error, permit saving if user is deliberately configuring
    if (testOnly) {
      return NextResponse.json({ error: `Connection failed: ${err.message}` }, { status: 502 })
    }
  }

  if (testOnly) {
    return NextResponse.json({ success: true, message: 'OpenRouter API key is valid and connected!' })
  }

  // Update in-memory runtime environment
  process.env.OPENROUTER_API_KEY = cleanKey
  process.env.OPENROUTER_MODEL = cleanModel

  // Update .env.local on disk to persist across server restarts
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''

    if (content.includes('OPENROUTER_API_KEY=')) {
      content = content.replace(/OPENROUTER_API_KEY=.*/g, `OPENROUTER_API_KEY=${cleanKey}`)
    } else {
      content += `\nOPENROUTER_API_KEY=${cleanKey}`
    }

    if (content.includes('OPENROUTER_MODEL=')) {
      content = content.replace(/OPENROUTER_MODEL=.*/g, `OPENROUTER_MODEL=${cleanModel}`)
    } else {
      content += `\nOPENROUTER_MODEL=${cleanModel}`
    }

    fs.writeFileSync(envPath, content.trim() + '\n', 'utf8')
  } catch (fsErr) {
    console.error('Could not write to .env.local', fsErr)
  }

  return NextResponse.json({
    success: true,
    isConfigured: true,
    model: cleanModel,
    message: 'OpenRouter API key saved successfully!',
  })
}
