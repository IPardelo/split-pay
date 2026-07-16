/** Tipos do dominio. Todos os importes son ENTEIROS na unidade mínima: nunca float. */

export type UUID = string
/** Importe na unidade mínima da moeda (céntimos). Sempre enteiro. */
export type Cents = number

export type SplitMode = 'EQUAL' | 'SHARES' | 'EXACT' | 'PERCENT'
export type EntryType = 'EXPENSE' | 'INCOME' | 'TRANSFER'
export type RecurrenceRule = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'

/** Onde vive o grupo: só neste dispositivo, ou sincronizado con Firebase. */
export type SyncMode = 'LOCAL' | 'ONLINE'

/**
 * Como se propoñen os pagos para saldar contas.
 *   POOL  «bote»  · menos pagos, mirando só o saldo final de cada un.
 *   PARTY «festa» · cada un paga a quen adiantou o que consumiu, gasto a gasto.
 */
export type SettleMode = 'POOL' | 'PARTY'

export interface Participant {
  id: UUID
  name: string
  color: string
  /** Soft delete: un participante con movementos nunca se borra de verdade. */
  deletedAt: string | null
}

/** Un importe atribuído a un participante (xa resolto e redondeado). */
export interface Allocation {
  participantId: UUID
  amount: Cents
}

/** Peso dun participante dentro do reparto, segundo o modo. */
export interface SplitEntry {
  participantId: UUID
  /** EQUAL: ignorado · SHARES: nº de partes · EXACT: céntimos · PERCENT: % */
  value: number
}

export interface SplitSpec {
  mode: SplitMode
  entries: SplitEntry[]
}

/**
 * Imaxe adxunta a un movemento.
 * `url` pode ser unha URL https (Firebase Storage) ou `idb:<id>`, que significa
 * que o ficheiro está gardado no IndexedDB deste dispositivo e non viaxa.
 */
export interface Attachment {
  id: UUID
  url: string
  name: string
  mime: string
  width: number
  height: number
  size: number
  createdAt: string
}

export type ActivityType =
  | 'CREATE_GROUP'
  | 'UPDATE_GROUP'
  | 'CREATE_ENTRY'
  | 'UPDATE_ENTRY'
  | 'DELETE_ENTRY'
  | 'RESTORE_ENTRY'
  | 'ADD_PARTICIPANT'
  | 'REMOVE_PARTICIPANT'
  | 'SETTLE'
  | 'RECURRING'

/** Rexistro de que pasou no grupo. Sincronízase como un movemento máis. */
export interface Activity {
  id: UUID
  at: string
  type: ActivityType
  /** Quen o fixo, segundo o «eu» do dispositivo que o fixo. */
  participantId: UUID | null
  entryId: UUID | null
  /** Texto de apoio: título do movemento, nome do participante… */
  data: string
}

export interface Entry {
  id: UUID
  type: EntryType
  title: string
  category: string
  /** ISO YYYY-MM-DD */
  date: string
  /** Moeda na que se pagou realmente. */
  currency: string
  amountOriginal: Cents
  /** Unidades de moeda base por 1 unidade de `currency`. CONXELADO ao crear. */
  fxRate: number
  /** amountOriginal convertido á moeda base do grupo. Conxelado. */
  amountBase: Cents
  /** Quen puxo o diñeiro. Soporta varios pagadores. */
  payers: Allocation[]
  /** Como se pediu repartir. */
  split: SplitSpec
  /** Resultado do reparto, conxelado: a quen lle corresponde canto. */
  shares: Allocation[]
  note: string
  /** Fotos do ticket e demais. */
  documents: Attachment[]
  /** Cada canto se repite. NONE = non se repite. */
  recurrence: RecurrenceRule
  /**
   * Data na que hai que xerar a seguinte repetición. Só o último movemento da
   * cadea a ten; os anteriores quedan con null e xa non xeran nada.
   */
  recurrenceNextAt: string | null
  /** Movemento do que saíu esta repetición. */
  recurrenceParentId: UUID | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Group {
  id: UUID
  shareToken: string
  /** LOCAL: só neste dispositivo · ONLINE: sincronizado con Firebase. */
  sync: SyncMode
  title: string
  /** Notas do grupo: onde durmimos, o IBAN de cadaquén, o que faga falta. */
  description: string
  baseCurrency: string
  participants: Participant[]
  entries: Entry[]
  activities: Activity[]
  /** Tipos de cambio do grupo: unidades de base por 1 unidade da moeda. */
  rates: Record<string, number>
  /** Cando se actualizaron os tipos desde a API, se se fixo. */
  ratesUpdatedAt: string | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  /** Marcado como favorito: aparece arriba na lista. */
  favorite: boolean
  /** Que participante son eu neste dispositivo. */
  meParticipantId: UUID | null
}

export interface AppState {
  version: number
  groups: Group[]
  lastGroupId: UUID | null
}

export interface Transfer {
  from: UUID
  to: UUID
  amount: Cents
}

/**
 * Categorías agrupadas, coma en Spliit: o selector amosa as agrupacións.
 * As etiquetas viven en src/i18n (chaves `cat.<id>` e `catgroup.<id>`).
 */
export const CATEGORIES = [
  { id: 'general', icon: '🧾', group: 'general' },
  { id: 'food', icon: '🍽️', group: 'food' },
  { id: 'groceries', icon: '🛒', group: 'food' },
  { id: 'drinks', icon: '🍻', group: 'food' },
  { id: 'transport', icon: '🚗', group: 'transport' },
  { id: 'fuel', icon: '⛽', group: 'transport' },
  { id: 'flight', icon: '✈️', group: 'transport' },
  { id: 'parking', icon: '🅿️', group: 'transport' },
  { id: 'lodging', icon: '🏠', group: 'home' },
  { id: 'rent', icon: '🔑', group: 'home' },
  { id: 'bills', icon: '💡', group: 'home' },
  { id: 'internet', icon: '📶', group: 'home' },
  { id: 'fun', icon: '🎉', group: 'life' },
  { id: 'culture', icon: '🎭', group: 'life' },
  { id: 'sport', icon: '⚽', group: 'life' },
  { id: 'shopping', icon: '🛍️', group: 'life' },
  { id: 'gifts', icon: '🎁', group: 'life' },
  { id: 'health', icon: '💊', group: 'life' },
  { id: 'other', icon: '✨', group: 'general' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

export const CATEGORY_GROUPS = ['general', 'food', 'transport', 'home', 'life'] as const

export const CATEGORY_BY_ID: Record<string, { id: string; icon: string; group: string }> =
  Object.fromEntries(CATEGORIES.map((c) => [c.id, c] as const))

export const PALETTE = [
  '#0ea5e9', '#f43f5e', '#22c55e', '#f59e0b', '#a855f7',
  '#14b8a6', '#ef4444', '#3b82f6', '#eab308', '#ec4899',
  '#84cc16', '#6366f1',
]
