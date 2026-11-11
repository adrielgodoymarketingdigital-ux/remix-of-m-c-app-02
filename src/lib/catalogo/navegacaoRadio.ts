// Teclado de um grupo de opções no padrão "radio" (WAI-ARIA): um só ponto de Tab e as setas
// andam (e escolhem) entre as opções, dando a volta nas pontas; Home/End vão à primeira/última.

/** Índice seguinte para a tecla, ou null quando a tecla não é de navegação. */
export function proximoIndiceRadio(tecla: string, atual: number, total: number): number | null {
  if (total <= 0) return null;
  const i = atual >= 0 && atual < total ? atual : 0;
  switch (tecla) {
    case "ArrowRight":
    case "ArrowDown":
      return (i + 1) % total;
    case "ArrowLeft":
    case "ArrowUp":
      return (i - 1 + total) % total;
    case "Home":
      return 0;
    case "End":
      return total - 1;
    default:
      return null;
  }
}
