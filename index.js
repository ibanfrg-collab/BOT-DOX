const { Telegraf } = require('telegraf');
const axios = require('axios');
const mongoose = require('mongoose');
const express = require('express');

// NUEVO Token oficial actualizado por el usuario
const bot = new Telegraf('8664870579:AAFnGiYkELkVqHnyEUKF2YZJjQYNZn--Y-U'); 

// ID del Dueño Absoluto
const OWNER_ID = 8116120039;

// Control de estados en memoria (temporal por consulta)
const esperandoNumero = {};
const cacheConsultas = {}; 

// --- CONEXIÓN MONGO DIRECTA Y FIJA ---
const MONGO_URI = "mongodb+srv://cuervox:cuervo2026@cluster0.v9z3x.mongodb.net/ojodios?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log("📦 Conectado con éxito a la base de datos fija"))
    .catch(err => console.error("❌ Error en BD:", err));

// Esquema para Vendedores
const SellerSchema = new mongoose.Schema({ sellerId: Number });
const Seller = mongoose.model('Seller', SellerSchema);

// Esquema para Clientes VIP
const VipSchema = new mongoose.Schema({
    clienteId: Number,
    acceso: String 
});
const Vip = mongoose.model('Vip', VipSchema);

// --- VALIDAR ACCESOS ---
async function verificarAcceso(ctx) {
    const userId = ctx.from.id;
    if (userId === OWNER_ID) return true;

    const esSeller = await Seller.findOne({ sellerId: userId });
    if (esSeller) return true;

    const vipData = await Vip.findOne({ clienteId: userId });
    
    if (!vipData) {
        ctx.reply("❌ No tienes acceso, compra tu acceso con @El_CuervoX");
        return false;
    }

    if (vipData.acceso === 'perm') return true;

    if (new Date(vipData.acceso) > new Date()) {
        return true;
    } else {
        ctx.reply("❌ RENUEVA TU ACCESO CON @El_CuervoX");
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
        const esSeller = await Seller.findOne({ sellerId: userId });
        if (esSeller) {
            tipoMembresia = "💼 Seller / Vendedor Autorizado";
        } else {
            const vipData = await Vip.findOne({ clienteId: userId });
            if (vipData) {
                if (vipData.acceso === 'perm') {
                    tipoMembresia = "💎 VIP Permanente";
                } else if (new Date(vipData.acceso) > new Date()) {
                    const fechaFormat = new Date(vipData.acceso).toISOString().split('T')[0];
                    tipoMembresia = `⏱️ VIP Activo (Vence: ${fechaFormat})`;
                } else {
                    tipoMembresia = "❌ Membresía Expirada";
                }
            }
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
    const esSeller = await Seller.findOne({ sellerId: userId });
    const esOwner = userId === OWNER_ID;

    if (!esSeller && !esOwner) return enviarStart(ctx);

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
    const esSeller = await Seller.findOne({ sellerId: userId });
    const esOwner = userId === OWNER_ID;

    if (!esSeller && !esOwner) return; 

    const listaSellers = await Seller.find({});
    const listaVips = await Vip.find({});

    let output = `╔════════════════════════╗\n📋   *BASE DE DATOS ACTIVA* \n╚════════════════════════╝\n\n`;
    if (esOwner) {
        output += `💼 *VENDEDORES (${listaSellers.length}):*\n`;
        listaSellers.forEach(s => { output += ` ├ \`${s.sellerId}\`\n`; });
        output += `─────────────────────────\n\n`;
    }

    output += `💎 *VIPs (${listaVips.length}):*\n`;
    listaVips.forEach(v => {
        if (v.acceso === 'perm') {
            output += ` ├ 🆔 \`${v.clienteId}\` ➔ \`💎 Perm\`\n`;
        } else {
            const expira = new Date(v.acceso);
            output += ` ├ 🆔 \`${v.clienteId}\` ➔ \`${expira > new Date() ? '⏱️ Activo' : '❌ Expirado'}\`\n`;
        }
    });
    ctx.reply(output, { parse_mode: 'Markdown' });
});

bot.command('addseller', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const sId = parseInt(ctx.message.text.split(' ')[1]);
    if (!sId || isNaN(sId)) return ctx.reply("❌ Uso: `/addseller [ID]`");
    
    const yaExiste = await Seller.findOne({ sellerId: sId });
    if (!yaExiste) await Seller.create({ sellerId: sId });
    ctx.reply(`✅ \`${sId}\` guardado como Seller.`, { parse_mode: 'Markdown' });
});

bot.command('delseller', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const sId = parseInt(ctx.message.text.split(' ')[1]);
    if (!sId || isNaN(sId)) return ctx.reply("❌ Uso: `/delseller [ID]`");
    
    await Seller.deleteOne({ sellerId: sId });
    ctx.reply("🗑️ Seller revocado.");
});

bot.command('vender', async (ctx) => {
    const sellerId = ctx.from.id;
    const esSeller = await Seller.findOne({ sellerId: sellerId });
    const esOwner = sellerId === OWNER_ID;
    if (!esSeller && !esOwner) return; 

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

    await Vip.findOneAndUpdate({ clienteId: clienteId }, { acceso: stringAcceso }, { upsert: true });
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

// Servidor express para que Render mantenga vivo el servicio
const app = express();
app.get('/', (req, res) => res.send('Bot Activo'));
app.listen(process.env.PORT || 3000, () => console.log("Bot listo."));

bot.launch();
