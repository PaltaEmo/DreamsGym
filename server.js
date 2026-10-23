require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Elimina explícitamente la cabecera que delata Express
app.disable('x-powered-by');

// 2. Configura Helmet para inyectar cabeceras de seguridad
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.tailwindcss.com",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com"
        ],
        scriptSrcAttr: ["'unsafe-inline'"], // Permite atributos inline como onclick, onsubmit, etc.
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com"
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com"
        ],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// 3. Middlewares de parseo
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 4. Configuración única y blindada de sesión
app.use(
  session({
    name: '__Host-session',
    secret: process.env.SESSION_SECRET || 'dreams_gym_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // Bloquea acceso a la cookie desde document.cookie
      secure: process.env.NODE_ENV === 'production', // true solo sobre HTTPS en producción
      sameSite: 'lax', // Protege contra CSRF
      maxAge: 1000 * 60 * 60 * 24 // 24 horas
    }
  })
);

// Configuración de conexión a NeonDB
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const db = {
    query: (text, params) => pool.query(text, params)
};

// Lista de clientes conectados a Server-Sent Events (SSE)
let clientesNotificaciones = [];

// Función para determinar si una fecha es Hoy o Mañana
function verificarDia(fechaStr) {
    const ahora = new Date();
    const hoyStr = ahora.toLocaleDateString('en-CA');
    
    const manana = new Date(ahora);
    manana.setDate(manana.getDate() + 1);
    const mananaStr = manana.toLocaleDateString('en-CA');

    if (fechaStr === hoyStr) return 'Hoy';
    if (fechaStr === mananaStr) return 'Mañana';
    return null;
}

// Middleware de autenticación
function requerirAutenticacion(req, res, next) {
    if (!req.session || !req.session.usuario) {
        return res.redirect('/login');
    }
    next();
}

// ---------------- RUTAS DE AUTENTICACIÓN ----------------

app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    if (req.session.usuario) {
        return res.redirect('/dashboard');
    }
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.render('login', { error: 'Por favor ingresa usuario y contraseña.' });
    }

    try {
        const result = await db.query(
            'SELECT * FROM sp_login_usuario($1::VARCHAR)', 
            [username.trim()]
        );

        if (result.rows.length === 0) {
            return res.render('login', { error: 'El usuario no existe o se encuentra inactivo.' });
        }

        const usuario = result.rows[0];
        const coincide = await bcrypt.compare(password.trim(), usuario.password_hash);

        if (!coincide) {
            return res.render('login', { error: 'Contraseña incorrecta.' });
        }

        req.session.usuario = {
            id: usuario.id,
            username: usuario.username,
            nombre_completo: usuario.nombre_completo,
            cargo: usuario.cargo,
            area: usuario.area,
            rol: usuario.rol
        };

        res.redirect('/dashboard');
    } catch (err) {
        console.error('[LOGIN ERROR]:', err.message);
        res.render('login', { error: 'Error del servidor: ' + err.message });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// ---------------- CANAL SSE (NOTIFICACIONES EN VIVO) ----------------

app.get('/api/notificaciones/stream', requerirAutenticacion, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clienteId = req.session.usuario.id;
    const nuevoCliente = { id: clienteId, res };
    clientesNotificaciones.push(nuevoCliente);

    req.on('close', () => {
        clientesNotificaciones = clientesNotificaciones.filter(c => c.res !== res);
    });
});

// ---------------- RUTAS DEL DASHBOARD Y RESERVAS ----------------

app.get('/dashboard', requerirAutenticacion, (req, res) => {
    res.render('dashboard', { usuario: req.session.usuario });
});

// Obtener reservas y aforo por fecha
app.get('/api/horarios', requerirAutenticacion, async (req, res) => {
    const fecha = req.query.fecha;
    if (!fecha) {
        return res.status(400).json({ error: 'La fecha es obligatoria.' });
    }

    const usuarioId = req.session.usuario.id;
    const esAdmin = req.session.usuario.rol === 'ADMIN';

    try {
        const queryReservas = await db.query(
            'SELECT * FROM sp_listar_reservas_activas($1::VARCHAR)',
            [fecha]
        );

        const queryCanceladas = await db.query(
            `SELECT DISTINCT hora_inicio 
             FROM reservas 
             WHERE fecha = $1::DATE AND estado = 'CANCELADA' 
             ORDER BY hora_inicio ASC`,
            [fecha]
        );

        const horasCanceladas = queryCanceladas.rows.map(
            r => `${String(r.hora_inicio).padStart(2, '0')}:00`
        );

        const reservasDelDia = queryReservas.rows;
        const bloques = [];

        for (let h = 0; h < 24; h++) {
            const reservasHora = reservasDelDia.filter(r => r.hora_inicio === h);
            const miReserva = reservasHora.find(r => r.usuario_id === usuarioId);

            bloques.push({
                hora: h,
                horaTexto: `${String(h).padStart(2, '0')}:00 - ${String((h + 1) % 24).padStart(2, '0')}:00`,
                ocupados: reservasHora.length,
                capacidadMaxima: 4,
                disponible: reservasHora.length < 4 && !miReserva,
                reservadoPorMi: !!miReserva,
                reservaId: miReserva ? miReserva.id : null,
                participantes: esAdmin ? reservasHora.map(r => ({
                    nombre: r.nombre_completo,
                    cargo: r.cargo,
                    area: r.area
                })) : []
            });
        }

        res.json({ bloques, horasCanceladas });
    } catch (err) {
        console.error('Error al obtener horarios:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Crear reserva
app.post('/api/reservar', requerirAutenticacion, async (req, res) => {
    const { fecha, horaInicio } = req.body;
    const usuarioId = req.session.usuario.id;

    if (!fecha || horaInicio === undefined) {
        return res.status(400).json({ error: 'Datos incompletos para reservar.' });
    }

    try {
        await db.query(
            'CALL sp_crear_reserva($1::INT, $2::DATE, $3::INT)',
            [parseInt(usuarioId, 10), fecha, parseInt(horaInicio, 10)]
        );

        res.json({ ok: true, mensaje: 'Reserva realizada con éxito.' });
    } catch (err) {
        console.error('Error al reservar:', err.message);
        res.status(400).json({ error: err.message });
    }
});

// Cancelar reserva y emitir notificación SSE si es de Hoy o Mañana
app.post('/api/cancelar-reserva', requerirAutenticacion, async (req, res) => {
    const { reservaId } = req.body;
    const usuarioId = req.session.usuario.id;
    const esAdmin = req.session.usuario.rol === 'ADMIN';

    if (!reservaId) {
        return res.status(400).json({ error: 'ID de reserva obligatorio.' });
    }

    try {
        const infoRes = await db.query(
            "SELECT TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha_str, hora_inicio FROM reservas WHERE id = $1",
            [reservaId]
        );

        if (infoRes.rows.length === 0) {
            return res.status(404).json({ error: 'La reserva no existe.' });
        }

        const { fecha_str, hora_inicio } = infoRes.rows[0];

        await db.query('CALL sp_cancelar_reserva($1, $2, $3)', [
            parseInt(reservaId, 10),
            usuarioId,
            esAdmin
        ]);

        const diaNotif = verificarDia(fecha_str);

        if (diaNotif) {
            const horaTexto = `${String(hora_inicio).padStart(2, '0')}:00 hrs`;
            const payload = JSON.stringify({
                dia: diaNotif,
                hora: horaTexto
            });

            clientesNotificaciones.forEach(cliente => {
                if (cliente.id !== usuarioId) {
                    cliente.res.write(`data: ${payload}\n\n`);
                }
            });
        }

        res.json({ ok: true, mensaje: 'Reserva cancelada con éxito.' });
    } catch (err) {
        console.error('Error al cancelar reserva:', err.message);
        res.status(400).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});
