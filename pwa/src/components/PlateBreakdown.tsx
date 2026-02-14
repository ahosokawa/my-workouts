import { platesPerSide, formatPlateWeight, BARBELL_WEIGHT } from '../logic/plates'

const PLATE_COLORS: Record<number, string> = {
  45: 'bg-blue-600',
  25: 'bg-green-600',
  15: 'bg-yellow-600',
  10: 'bg-red-600',
  5: 'bg-purple-600',
  2.5: 'bg-orange-500',
  1.25: 'bg-gray-500',
}

export default function PlateBreakdown({ weight }: { weight: number }) {
  if (weight <= BARBELL_WEIGHT) return null
  const plates = platesPerSide(weight)
  if (plates.length === 0) return null

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {plates.flatMap((p) =>
        Array.from({ length: p.count }, (_, i) => (
          <span
            key={`${p.plateWeight}-${i}`}
            className={`text-[10px] px-1 py-0.5 rounded text-white ${PLATE_COLORS[p.plateWeight] ?? 'bg-gray-600'}`}
          >
            {formatPlateWeight(p.plateWeight)}
          </span>
        )),
      )}
      <span className="text-[10px] text-[#8e8e93]">/side</span>
    </div>
  )
}
