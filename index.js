const { Telegraf } = require('telegraf');
const axios = require('axios');
const { Pool } = require('pg');
const express = require('express');

// Token oficial NUEVO y actualizado
const bot = new Telegraf('8664870579:AAH-H8QYIA5qIA5z4HfszktMNI9viBDj08E'); 

// ID del Dueño Absoluto
const OWNER_ID = 8116120039;

// Enlace oficial de tu base de datos PostgreSQL en Render
const POSTGRES_URL = "postgresql://cuervo:0EeaYwdcpetEi110JkCEbKaxibckNAp4@dpg-d999nn8k1i2s73dsr5ug-a.oregon-postgres.render.com/ojodios";

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
    connectionString: POSTGRES_URL,
    ssl: { rejectUnauthorized: false } // Requerido para conectar de forma segura a Render
});

// Control de estados en memoria (temporal por consulta)
const esperandoNumero = {};
const cacheConsultas = {}; 

// --- CREACIÓN DE TABLAS AUTOMÁTICA ---
async function iniciarBD() {
    try {
        // Tabla de Vendedores
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sellers (
                seller_id BIGINT PRIMARY KEY
            );
        `);
        // Tabla de Clientes VIP
        await pool.query(`
            CREATE TABLE IF NOT EXISTS vips (
                cliente_id BIGINT PRIMARY KEY,
                acceso TEXT
            );
        `);
        console.log("📦 PostgreSQL listo y tablas verificadas con éxito.");
    } catch (err) {
        console.error("❌ Error al inicializar tablas en Postgres:", err);
    }
}
iniciarBD();

// --- VALIDAR ACCESOS ---
async function verificarAcceso(ctx) {
    const userId = ctx.from.id;
    if (userId === OWNER_ID) return true;

    try {
        const esSeller = await pool.query('SELECT 1 FROM sellers WHERE seller_id = $1', [userId]);
        if (esSeller.rowCount > 0) return true;

        const vipRes = await pool.query('SELECT acceso FROM vips WHERE cliente_id = $1', [userId]);
        if (vipRes.rowCount === 0) {
            ctx.reply("❌ No tienes acceso, compra tu acceso con @El_CuervoX");
            return false;
        }

        const acceso = vipRes.rows[0].acceso;
        if (acceso === 'perm') return true;

        if (new Date(acceso) > new Date()) {
            return true;
        } else {
            ctx.reply("❌ RENUEVA TU ACCESO CON @El_CuervoX");
            return false;
        }
    } catch (e) {
        console.error(e);
        ctx.reply("⚠️ Error temporal al verificar acceso.");
        return false;
    }
}

async function enviarStart(ctx) {
    const userId = ctx.from.id;
    const username = ctx.from.username ? `@${ctx.from.username}` : "No configurado";
    const nombreCompleto = `${ctx.from.first_name} ${ctx.from.last_name || ''}`.trim();
    
    let tipoMembresia = "❌ Sin acceso activo";

    if (userId === OWNER_ID) {
        tipoMembresia = "👑 Owner / Creador";
    } else {
        try {
            const esSeller = await pool.query('SELECT 1 FROM sellers WHERE seller_id = $1', [userId]);
            if (esSeller.rowCount > 0) {
                tipoMembresia = "💼 Seller / Vendedor Autorizado";
            } else {
                const vipRes = await pool.query('SELECT acceso FROM vips WHERE cliente_id = $1', [userId]);
                if (vipRes.rowCount > 0) {
                    const acceso = vipRes.rows[0].acceso;
                    if (acceso === 'perm') {
                        tipoMembresia = "💎 VIP Permanente";
                    } else if (new Date(acceso) > new Date()) {
                        const fechaFormat = new Date(acceso).toISOString().split('T')[0];
                        tipoMembresia = `⏱️ VIP Activo (Vence: ${fechaFormat})`;
                    } else {
                        tipoMembresia = "❌ Membresía Expirada";
                    }
                }
            }
        } catch (e) {
            tipoMembresia = "⚠️ Error de lectura";
        }
    }

    let bienvenidaPanel = `👁️ *¡Bienvenido al Ojo de Dios!* \n`;
    bienvenidaPanel += `Para realizar una consulta presiona el comando /nequi\n\n`;
    bienvenidaPanel += `╔════════════════════════╗\n`;
    bienvenidaPanel += `   👤   *MI PERFIL DE ACCESO* \n`;
    bienvenidaPanel += `╚════════════════════════╝\n\n`;
    bienvenidaPanel += `🆔 *Tu ID:* \`${userId}\`\n`;
    bienvenidaPanel += `👤 *Usuario:* ${username}\n`;
    bienvenidaPanel += `📝 *Nombre:* \`${nombreCompleto}\`\n`;
    bienvenidaPanel += `🏅 *Membresía:* *${tipoMembresia}*\n`;
    bienvenidaPanel += `─────────────────────────\n`;
    bienvenidaPanel += `✨ *by : @El_CuervoX*`;

    ctx.reply(bienvenidaPanel, { parse_mode: 'Markdown' });
}

bot.start((ctx) => { enviarStart(ctx); });

bot.command('nequi', async (ctx) => {
    const accesoAutorizado = await verificarAcceso(ctx);
    if (!accesoAutorizado) return;
    esperandoNumero[ctx.from.id] = true;
    ctx.reply("📱 Envía el número a consultar:");
});

bot.command('panel', async (ctx) => {
    const userId = ctx.from.id;
    const esSeller = await pool.query('SELECT 1 FROM sellers WHERE seller_id = $1', [userId]);
    const esOwner = userId === OWNER_ID;

    if (esSeller.rowCount === 0 && !esOwner) return enviarStart(ctx);

    let menu = `╔════════════════════════╗\n⚙️   *PANEL DE CONTROL* \n╚════════════════════════╝\n\n`;
    if (esOwner) {
        menu += `👑 *RANGO:* \`Owner / Dueño\`\n\n📝 *COMANDOS:*\n🔹 \`/vender [ID] [Dias/perm]\`\n🔹 \`/lista\`\n🔹 \`/addseller [ID]\`\n🔹 \`/delseller [ID]\`\n`;
    } else {
        menu += `💼 *RANGO:* \`Seller Autorizado\`\n\n📝 *COMANDOS:*\n🔹 \`/vender [ID] [Dias/perm]\`\n🔹 \`/lista\`\n`;
    }
    menu += `─────────────────────────\n✨ *by : @El_CuervoX*`;
    ctx.reply(menu, { parse_mode: 'Markdown' });
});

bot.command('lista', async (ctx) => {
    const userId = ctx.from.id;
    const esSeller = await pool.query('SELECT 1 FROM sellers WHERE seller_id = $1', [userId]);
    const esOwner = userId === OWNER_ID;

    if (esSeller.rowCount === 0 && !esOwner) return; 

    const listaSellers = await pool.query('SELECT seller_id FROM sellers');
    const listaVips = await pool.query('SELECT cliente_id, acceso FROM vips');

    let output = `╔════════════════════════╗\n📋   *BASE DE DATOS ACTIVA* \n╚════════════════════════╝\n\n`;
    if (esOwner) {
        output += `💼 *VENDEDORES (${listaSellers.rowCount}):*\n`;
        listaSellers.rows.forEach(s => { output += ` ├ \`${s.seller_id}\`\n`; });
        output += `─────────────────────────\n\n`;
    }

    output += `💎 *VIPs (${listaVips.rowCount}):*\n`;
    listaVips.rows.forEach(v => {
        if (v.acceso === 'perm') {
            output += ` ├ 🆔 \`${v.cliente_id}\` ➔ \`💎 Perm\`\n`;
        } else {
            const expira = new Date(v.acceso);
            output += ` ├ 🆔 \`${v.cliente_id}\` ➔ \`${expira > new Date() ? '⏱️ Activo' : '❌ Expirado'}\`\n`;
        }
    });
    ctx.reply(output, { parse_mode: 'Markdown' });
});

bot.command('addseller', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const sId = parseInt(ctx.message.text.split(' ')[1]);
    if (!sId || isNaN(sId)) return ctx.reply("❌ Uso: `/addseller [ID]`");
    
    await pool.query('INSERT INTO sellers (seller_id) VALUES ($1) ON CONFLICT (seller_id) DO NOTHING', [sId]);
    ctx.reply(`✅ \`${sId}\` guardado como Seller.`, { parse_mode: 'Markdown' });
});

bot.command('delseller', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const sId = parseInt(ctx.message.text.split(' ')[1]);
    if (!sId || isNaN(sId)) return ctx.reply("❌ Uso: `/delseller [ID]`");
    
    await pool.query('DELETE FROM sellers WHERE seller_id = $1', [sId]);
    ctx.reply("🗑️ Seller revocado.");
});

bot.command('vender', async (ctx) => {
    const sellerId = ctx.from.id;
    const esSeller = await pool.query('SELECT 1 FROM sellers WHERE seller_id = $1', [sellerId]);
    const esOwner = sellerId === OWNER_ID;
    if (esSeller.rowCount === 0 && !esOwner) return; 

    const args = ctx.message.text.split(' ');
    const clienteId = parseInt(args[1]);
    const tiempo = args[2];

    if (!clienteId || isNaN(clienteId) || !tiempo) return ctx.reply("❌ Uso: `/vender [ID] [Dias/perm]`");

    let stringAcceso = 'perm';
    if (tiempo.toLowerCase() !== 'perm') {
        let l = new Date();
        l.setDate(l.getDate() + parseInt(tiempo));
        stringAcceso = l.toISOString();
    }

    await pool.query(`
        INSERT INTO vips (cliente_id, acceso) VALUES ($1, $2)
        ON CONFLICT (cliente_id) DO UPDATE SET acceso = EXCLUDED.acceso
    `, [clienteId, stringAcceso]);

    ctx.reply(`✅ *Venta guardada en Base de Datos!*`, { parse_mode: 'Markdown' });
    bot.telegram.sendMessage(clienteId, `🎉 *Acceso activado!* Presiona /nequi`, { parse_mode: 'Markdown' }).catch(()=>{});
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    if (!esperandoNumero[userId]) return;
    delete esperandoNumero[userId];

    const numero = ctx.message.text.trim();
    if (isNaN(numero) || numero.length < 7) return ctx.reply("❌ Número inválido.");

    const accesoAutorizado = await verificarAcceso(ctx);
    if (!accesoAutorizado) return;

    if (cacheConsultas[numero]) {
        const d = cacheConsultas[numero];
        let r = `📱 *Celular:* \`${numero}\` (Caché)\n\n`;
        for (const [k, v] of Object.entries(d)) { r += `🔹 *${k.toUpperCase()}:* \`${v}\`\n`; }
        return ctx.reply(r, { parse_mode: 'Markdown' });
    }

    const msg = await ctx.reply("⏳ *Iniciando consulta... [░░░░░░░░░░] 0%*", { parse_mode: 'Markdown' });
    const delay = (ms) => new Promise(res => setTimeout(res, ms));
    
    try {
        await delay(300);
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, "⚡ *Buscando... [██████░░░░] 60%*", { parse_mode: 'Markdown' }).catch(()=>{});
        
        const res = await axios.get(`https://cuervo-api.vercel.app/nequi/${numero}?key=ohhyejin1`);
        const data = res.data;

        if (data.error) {
            await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(()=>{});
            return ctx.reply(`⚠️ Error: ${data.error}`);
        }

        cacheConsultas[numero] = data;
        let r = `👁️ *EL OJO DE DIOS*\n\n📱 *Celular:* \`${numero}\`\n\n`;
        for (const [k, v] of Object.entries(data)) {
            if (k==='eps' || k==='tiempo') continue;
            r += `🔹 *${k.toUpperCase()}:* \`${v}\`\n`;
        }
        
        await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(()=>{});
        ctx.reply(r, { parse_mode: 'Markdown' });
    } catch (e) {
        await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(()=>{});
        ctx.reply("❌ Error al conectar.");
    }
});

// --- CONFIGURACIÓN PARA RENDER (EXPRESS) ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot Activo y Corriendo');
});

app.listen(PORT, () => {
    console.log(`🤖 Servidor web listo en el puerto ${PORT}`);
    
    bot.launch()
        .then(() => console.log("🚀 Bot de Telegram iniciado correctamente con el nuevo token."))
        .catch((err) => {
            console.error("❌ Error al iniciar Telegram:", err.message);
        });
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
