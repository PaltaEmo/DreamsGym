function mostrarDiaMobile(indice) {
  document.querySelectorAll('.seccion-dia-mobile').forEach(el => el.classList.add('hidden'));
  const contenedor = document.getElementById(`contenedor-dia-${indice}`);
  if (contenedor) contenedor.classList.remove('hidden');

  document.querySelectorAll('.dia-btn').forEach(btn => {
    btn.className = 'dia-btn snap-start shrink-0 flex flex-col items-center justify-center min-w-[78px] py-2.5 px-3 rounded-2xl border text-center transition bg-dreams-card text-slate-300 border-dreams-border';
    const badge = btn.querySelector('span:last-child');
    if (badge) badge.className = 'text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-[#0a1024] text-dreams-gold border border-dreams-gold/30';
  });

  const btnActivo = document.getElementById(`btn-dia-${indice}`);
  if (btnActivo) {
    btnActivo.className = 'dia-btn snap-start shrink-0 flex flex-col items-center justify-center min-w-[78px] py-2.5 px-3 rounded-2xl border text-center transition bg-gradient-to-b from-dreams-gold to-[#b89428] text-black border-dreams-gold shadow-md font-bold';
    const badgeActivo = btnActivo.querySelector('span:last-child');
    if (badgeActivo) badgeActivo.className = 'text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-black/20 text-black';
  }
}

function handleReservaClick(btn) {
  const fecha = btn.dataset.fecha;
  const hora = parseInt(btn.dataset.hora, 10);
  const semana = btn.dataset.semana;

  if (!confirm(`¿Confirmas reserva para el ${fecha} a las ${String(hora).padStart(2, '0')}:00 hrs?`)) return;

  fetch('/reservar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fecha, hora_inicio: hora, tipo_semana: semana })
  })
  .then(res => res.json())
  .then(data => {
    if (!data.ok) throw new Error(data.error);
    alert('✓ ' + data.message);
    window.location.reload();
  })
  .catch(err => alert('Error al reservar: ' + err.message));
}

function handleCancelarClick(btn) {
  const reservaId = btn.dataset.id;
  if (!confirm('¿Deseas cancelar esta hora? (Requiere al menos 24 horas de anticipación)')) return;

  fetch(`/cancelar/${reservaId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(res => res.json())
  .then(data => {
    if (!data.ok) throw new Error(data.error);
    alert('✓ ' + data.message);
    window.location.reload();
  })
  .catch(err => alert('Error de cancelación: ' + err.message));
}