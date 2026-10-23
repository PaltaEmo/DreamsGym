function obtenerFechasSemana(offsetSemanas = 0) {
  const hoy = new Date();
  const diaSemana = hoy.getDay();
  const diferenciaALunes = (diaSemana === 0 ? -6 : 1) - diaSemana;

  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diferenciaALunes + (offsetSemanas * 7));
  lunes.setHours(0, 0, 0, 0);

  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  domingo.setHours(23, 59, 59, 999);

  const diasSemana = [];
  for (let i = 0; i < 7; i++) {
    const dia = new Date(lunes);
    dia.setDate(lunes.getDate() + i);
    const yyyy = dia.getFullYear();
    const mm = String(dia.getMonth() + 1).padStart(2, '0');
    const dd = String(dia.getDate()).padStart(2, '0');
    diasSemana.push(`${yyyy}-${mm}-${dd}`);
  }

  return {
    inicio: diasSemana[0],
    fin: diasSemana[6],
    fechas: diasSemana
  };
}

module.exports = { obtenerFechasSemana };