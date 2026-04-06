/** Height in cm, weight in kg → BMI (kg/m²). */
export function calculateBMI(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  if (heightM <= 0 || weightKg <= 0 || !Number.isFinite(heightCm) || !Number.isFinite(weightKg)) {
    return NaN;
  }
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function getBMICategory(bmi: number): string {
  if (!Number.isFinite(bmi)) return "—";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal weight";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export function formatHealthContextForAI(m: {
  gender: string;
  age: number;
  height: number;
  weight: number;
  bmi: number;
  bmiCategory: string;
}): string {
  return `Gender: ${m.gender}, age ${m.age} years, height ${m.height} cm, weight ${m.weight} kg, BMI ${m.bmi} (${m.bmiCategory}).`;
}
