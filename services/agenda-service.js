const db = require('../db');

async function obtenerAgendaSemanal(fechaInicio, fechaFin, usuarioId) {
  const query = `
    SELECT 
      r.id AS reserva_id,
      r.usuario_id,
      TO_CHAR(r.fecha, 'YYYY-MM-DD') AS fecha,
      r.hora_inicio,
      r.es_excepcion,
      r.modificada_post,
      u.nombre_completo,
      (r.usuario_id = $3) AS es_mi_reserva
    FROM reservas r
    JOIN usuarios u ON r.usuario_id = u.id
    WHERE r.fecha BETWEEN $1 AND $2
      AND r.estado = 'RESERVADA'
    ORDER BY r.fecha ASC, r.hora_inicio ASC, r.created_at ASC;
  `;

  const { rows } = await db.query(query, [fechaInicio, fechaFin, usuarioId]);

  const conteoUsuarioPorDia = {};
  rows.forEach(r => {
    if (r.es_mi_reserva) {
      conteoUsuarioPorDia[r.fecha] = (conteoUsuarioPorDia[r.fecha] || 0) + 1;
    }
  });

  return {
    reservas: rows,
    conteoUsuarioPorDia
  };
}

module.exports = { obtenerAgendaSemanal };