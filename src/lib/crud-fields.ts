export type Field = {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'richtext' | 'number' | 'select' | 'toggle' | 'image' | 'date'
  options?: { value: string | number; label: string; parentValue?: string | number }[]
  dependsOn?: string
  required?: boolean
  placeholder?: string
}

export function fieldOptions(field: Field, values: Record<string, any>) {
  return (field.options ?? []).filter((option) => !field.dependsOn || String(option.parentValue) === String(values[field.dependsOn]))
}

export function changeField(fields: Field[], values: Record<string, any>, key: string, value: any) {
  const next = { ...values, [key]: value }
  for (const field of fields) {
    if (field.dependsOn === key && !fieldOptions(field, next).some((option) => String(option.value) === String(next[field.key]))) next[field.key] = ''
  }
  return next
}
