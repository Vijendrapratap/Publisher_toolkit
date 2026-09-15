export function nextRadioIndex(key: string, index: number, length: number): number | null {
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return (index + 1) % length
    case 'ArrowUp':
    case 'ArrowLeft':
      return (index - 1 + length) % length
    case 'Home':
      return 0
    case 'End':
      return length - 1
    default:
      return null
  }
}
