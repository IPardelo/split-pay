import { CATEGORIES } from '../core/types'
import { aiSettings, isAiConfigured } from '../store/settings'

/**
 * As dúas funcións de IA: ler un ticket e adiviñar a categoría.
 *
 * Ambas piden unha resposta con `json_schema` (structured outputs). Se o modelo
 * devolve algo que non encaixa, dicimos que non se puido extraer nada en vez de
 * encher o formulario con inventos.
 */

export interface ReceiptData {
  /** Importe en unidades (12.5 = 12,50), non en céntimos. */
  amount: number | null
  currency: string | null
  /** ISO YYYY-MM-DD */
  date: string | null
  title: string | null
  category: string | null
}

const CATEGORY_IDS = CATEGORIES.map((c) => c.id)

async function chat(model: string, body: Record<string, unknown>, signal?: AbortSignal) {
  if (!isAiConfigured()) throw new Error('AI is not configured')
  const config = aiSettings()
  const res = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model, ...body }),
    signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`AI: HTTP ${res.status} ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('AI: empty response')
  return JSON.parse(content) as unknown
}

/** Le a foto dun ticket e devolve o que se poida recoñecer. */
export async function extractReceipt(
  dataUrl: string,
  hints: { currency: string; today: string },
  signal?: AbortSignal,
): Promise<ReceiptData> {
  const parsed = (await chat(
    aiSettings().receiptModel,
    {
      messages: [
        {
          role: 'system',
          content:
            'You read receipts. Return only what is clearly legible; use null for anything you cannot read. ' +
            `Today is ${hints.today}. If the receipt has no year, assume the most recent plausible one. ` +
            `If no currency is printed, use ${hints.currency}. ` +
            'The title is a short human description of the purchase (the shop name is a good title).',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the total amount, currency, date, title and category.' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'receipt',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['amount', 'currency', 'date', 'title', 'category'],
            properties: {
              amount: { type: ['number', 'null'] },
              currency: { type: ['string', 'null'], description: 'ISO 4217 code' },
              date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
              title: { type: ['string', 'null'] },
              category: { type: ['string', 'null'], enum: [...CATEGORY_IDS, null] },
            },
          },
        },
      },
    },
    signal,
  )) as Partial<ReceiptData>

  return {
    amount: typeof parsed.amount === 'number' && Number.isFinite(parsed.amount) ? parsed.amount : null,
    currency: typeof parsed.currency === 'string' ? parsed.currency.toUpperCase().slice(0, 3) : null,
    date: typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null,
    title: typeof parsed.title === 'string' ? parsed.title.slice(0, 80) : null,
    category:
      typeof parsed.category === 'string' && CATEGORY_IDS.includes(parsed.category as never)
        ? parsed.category
        : null,
  }
}

/** Adiviña a categoría a partir do título do gasto. */
export async function suggestCategory(title: string, signal?: AbortSignal): Promise<string | null> {
  if (!title.trim()) return null
  const parsed = (await chat(
    aiSettings().categoryModel,
    {
      messages: [
        {
          role: 'system',
          content:
            'You classify shared expenses into one of a fixed list of categories. ' +
            'The title may be in Galician, Spanish or English. Answer with the category id only.',
        },
        { role: 'user', content: title.slice(0, 120) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'category',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['category'],
            properties: { category: { type: 'string', enum: CATEGORY_IDS } },
          },
        },
      },
    },
    signal,
  )) as { category?: string }

  return typeof parsed.category === 'string' && CATEGORY_IDS.includes(parsed.category as never)
    ? parsed.category
    : null
}

export { isAiConfigured }
