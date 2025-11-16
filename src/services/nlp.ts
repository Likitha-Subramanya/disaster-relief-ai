import type { Category } from '../models'

const keywordMap: Record<Category, string[]> = {
  medical: ['injury','doctor','medic','hospital','medicine','bleeding','ambulance','fracture','fever','sick'],
  rescue: ['trapped','rescue','collapsed','stuck','evacuate','help me','save','boat','lift','blocked'],
  shelter: ['shelter','homeless','evacuated','displaced','camp','tent','roof','stay','lodging'],
  supplies: ['food','water','blanket','supplies','kit','ration','milk','diaper','sanitary','flashlight'],
  unknown: []
}

export function classifyCategory(text: string): Category {
  const t = text.toLowerCase()
  let best: Category = 'unknown'
  let score = 0
  for (const [cat, words] of Object.entries(keywordMap) as [Category, string[]][]) {
    const s = words.reduce((acc,w)=> acc + (t.includes(w) ? 1 : 0), 0)
    if (s > score) { score = s; best = cat }
  }
  return best
}

export function estimateUrgency(text: string): number {
  const t = text.toLowerCase()
  let u = 2
  if (/(critical|urgent|immediate|bleeding|unconscious|trapped|child)/.test(t)) u += 2
  if (/(elderly|pregnant|disabled)/.test(t)) u += 1
  return Math.max(1, Math.min(5, u))
}
