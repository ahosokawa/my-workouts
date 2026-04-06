import type { Units } from '../types'
import { platesPerSide, formatPlateWeight, barbellWeight } from '../logic/plates'

const PLATE_COLORS_LBS: Record<number, string> = {
  45: 'bg-blue-600',
  25: 'bg-green-600',
  15: 'bg-yellow-600',
  10: 'bg-red-600',
  5: 'bg-purple-600',
  2.5: 'bg-orange-500',
  1.25: 'bg-gray-500',
}

const PLATE_COLORS_KG: Record<number, string> = {
  25: 'bg-red-600',
  20: 'bg-blue-600',
  15: 'bg-yellow-600',
  10: 'bg-green-600',
  5: 'bg-purple-600',
  2.5: 'bg-orange-500',
  1.25: 'bg-gray-500',
  0.5: 'bg-gray-400',
}

export default function PlateBreakdown({ weight, units = 'lbs' }: { weight: number; units?: Units }) {
  if (weight <= barbellWeight(units)) return null
  const plates = platesPerSide(weight, units)
  if (plates.length === 0) return null

  const colors = units === 'kg' ? PLATE_COLORS_KG : PLATE_COLORS_LBS

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {plates.flatMap((p) =>
        Array.from({ length: p.count }, (_, i) => (
          <span
            key={`${p.plateWeight}-${i}`}
            className={`text-[10px] px-1 py-0.5 rounded text-white ${colors[p.plateWeight] ?? 'bg-gray-600'}`}
          >
            {formatPlateWeight(p.plateWeight)}
          </span>
        )),
      )}
      <span className="text-[10px] text-[#8e8e93]">/side</span>
    </div>
  )
}
