export function numberWithThousandsSeparator(
  x: number,
  separator = " "
): string {
  return x ? x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator) : "";
}
