const {
    monospace,
    quote
} = require("@mengkodingan/ckptw");
const {
    Events
} = require("@mengkodingan/ckptw/lib/Constant");
const axios = require("axios");
const {
    exec
} = require("child_process");
const fs = require("fs");
const util = require("util");

// Utilitas
async function handleUserEvent(bot, m) {
    const {
        id,
        participants
    } = m;

    try {
        const groupId = id.split("@")[0];
        const groupWelcome = await db.get(`group.${groupId}.option.welcome`);

        if (groupWelcome) {
            const metadata = await bot.core.groupMetadata(id);
            const textWelcome = await db.get(`group.${groupId}.text.welcome`);
            const textGoodbye = await db.get(`group.${groupId}.text.goodbye`);

            for (const jid of participants) {
                const profilePictureUrl = await bot.core.profilePictureUrl(jid, "image").catch(() => "https://i.pinimg.com/736x/70/dd/61/70dd612c65034b88ebf474a52ccc70c4.jpg");

                const eventType = m.eventsType;
                const customText = eventType === "UserJoin" ? textWelcome : textGoodbye;
                const userTag = `@${jid.split("@")[0]}`;

                const text = customText ?
                    customText
                    .replace(/%tag%/g, userTag)
                    .replace(/%subject%/g, metadata.subject)
                    .replace(/%description%/g, metadata.description) :
                    (eventType === "UserJoin" ?
                        quote(`👋 Selamat datang ${userTag} di grup ${metadata.subject}!`) :
                        quote(`👋 ${userTag} keluar dari grup ${metadata.subject}.`));

                await bot.core.sendMessage(id, {
                    text,
                    contextInfo: {
                        mentionedJid: [jid],
                        externalAdReply: {
                            mediaType: 1,
                            previewType: 0,
                            mediaUrl: config.bot.website,
                            title: config.msg.watermark,
                            body: null,
                            renderLargerThumbnail: true,
                            thumbnailUrl: profilePictureUrl || config.bot.thumbnail,
                            sourceUrl: config.bot.website
                        }
                    }
                });

                const introText = await db.get(`group.${groupId}.text.intro`);
                if (eventType === "UserJoin" && introText) await bot.core.sendMessage(id, {
                    text: introText,
                    mentions: [jid]
                });
            }
        }
    } catch (error) {
        console.error(`[${config.pkg.name}] Error:`, error);
        await bot.core.sendMessage(id, {
            text: quote(`⚠️ Terjadi kesalahan: ${error.message}`)
        });
    }
}

module.exports = (bot) => {
    // Penanganan acara saat bot siap
    bot.ev.once(Events.ClientReady, async (m) => {
        console.log(`[${config.pkg.name}] Ready at ${m.user.id}`);
        if (!await db.get("bot.mode")) await db.set("bot.mode", "public");

        // Tetapkan config pada bot
        const id = m.user.id.split(":")[0];
        await Promise.all([
            config.bot.id = id,
            config.bot.jid = `${id}@s.whatsapp.net`,
            config.bot.readyAt = bot.readyAt
        ]);

        if (config.system.requireBotGroupMembership) {
            const code = await bot.core.groupInviteCode(config.bot.groupJid);
            config.bot.groupLink = `https://chat.whatsapp.com/${code}`;
        }
    });

    // Penanganan event ketika pesan muncul
    bot.ev.on(Events.MessagesUpsert, async (m, ctx) => {
        const isGroup = ctx.isGroup();
        const isPrivate = !isGroup;
        const senderJid = ctx.sender.jid;
        const senderId = senderJid.split(/[:@]/)[0];
        const groupJid = isGroup ? ctx.id : null;
        const groupId = isGroup ? groupJid.split("@")[0] : null;

        // Penanganan pada mode bot
        const botMode = await db.get("bot.mode");
        if (isPrivate && botMode === "group") return;
        if (isGroup && botMode === "private") return;
        if (!tools.general.isOwner(ctx, senderId, true) && botMode === "self") return;

        // Log pesan masuk
        if (isGroup) {
            console.log(`[${config.pkg.name}] Incoming message from group: ${groupId}, by: ${senderId}`);
        } else {
            console.log(`[${config.pkg.name}] Incoming message from: ${senderId}`);
        }

        // Basis data untuk pengguna
        const userDb = await db.get(`user.${senderId}`) || {};

        // Grup atau Pribadi
        if (isGroup || isPrivate) {
            // Penangan pada ukuran basis data
            config.bot.dbSize = fs.existsSync("database.json") ? tools.general.formatSize(fs.statSync("database.json").size / 1024) : "N/A"

            await db.set(`user.${senderId}`, {
                coin: (tools.general.isOwner(ctx, senderId, config.system.selfOwner) || userDb?.premium) ? 0 : (userDb?.coin || 1000),
                level: userDb?.level || 0,
                uid: userDb?.uid || tools.general.generateUID(senderId),
                xp: userDb?.xp || 0,
                ...userDb
            });

            // Penanganan untuk perintah
            const isCmd = tools.general.isCmd(m, ctx);
            if (isCmd) {
                if (config.system.autoTypingOnCmd) await ctx.simulateTyping(); // Simulasi pengetikan otomatis untuk perintah

                await Promise.all([
                    db.set(`user.${senderId}.lastUse`, Date.now()),
                    db.set(`group.${groupId}.lastUse`, Date.now())
                ]);

                // Did you mean?
                const mean = isCmd.didyoumean;
                const prefix = isCmd.prefix;
                const input = isCmd.input;

                if (mean) await ctx.reply(quote(`❎ Anda salah ketik, sepertinya ${monospace(prefix + mean)}.`));

                // Penanganan XP & Level untuk pengguna
                const xpGain = 10;
                let xpToLevelUp = 100;

                let newUserXp = userDb?.xp + xpGain;

                if (newUserXp >= xpToLevelUp) {
                    let newUserLevel = userDb?.level + 1;
                    newUserXp -= xpToLevelUp;

                    xpToLevelUp = Math.floor(xpToLevelUp * 1.2);

                    const profilePictureUrl = await ctx._client.profilePictureUrl(senderJid, "image").catch(() => "https://i.pinimg.com/736x/70/dd/61/70dd612c65034b88ebf474a52ccc70c4.jpg");

                    if (userDb?.autolevelup) await ctx.reply({
                        text: `${quote(`Selamat! Kamu telah naik ke level ${newUserLevel}!`)}\n` +
                            `${config.msg.readmore}\n` +
                            quote(tools.msg.generateNotes([`Terganggu? Ketik ${monospace(`${prefix}setprofile autolevelup`)} untuk menonaktifkan pesan autolevelup.`])),
                        contextInfo: {
                            externalAdReply: {
                                mediaType: 1,
                                previewType: 0,
                                mediaUrl: config.bot.website,
                                title: config.msg.watermark,
                                body: null,
                                renderLargerThumbnail: true,
                                thumbnailUrl: profilePictureUrl || config.bot.thumbnail,
                                sourceUrl: config.bot.website
                            }
                        }
                    });

                    await Promise.all([
                        db.set(`user.${senderId}.xp`, newUserXp),
                        db.set(`user.${senderId}.level`, newUserLevel)
                    ]);
                } else {
                    await db.set(`user.${senderId}.xp`, newUserXp);
                }
            }

            // Perintah khusus Owner
            if (tools.general.isOwner(ctx, senderId, config.system.selfOwner)) {
                // Perintah Eval: Jalankan kode JavaScript
                if (m.content && m.content.startsWith && (m.content.startsWith("==> ") || m.content.startsWith("=> "))) {
                    const code = m.content.slice(m.content.startsWith("==> ") ? 4 : 3);

                    try {
                        const result = await eval(m.content.startsWith("==> ") ? `(async () => { ${code} })()` : code);

                        await ctx.reply(monospace(util.inspect(result)));
                    } catch (error) {
                        console.error(`[${config.pkg.name}] Error:`, error);
                        await ctx.reply(quote(`⚠️ Terjadi kesalahan: ${error.message}`));
                    }
                }

                // Perintah Exec: Jalankan perintah shell
                if (m.content && m.content.startsWith && m.content.startsWith("$ ")) {
                    const command = m.content.slice(2);

                    try {
                        const output = await util.promisify(exec)(command);

                        await ctx.reply(monospace(output.stdout || output.stderr));
                    } catch (error) {
                        console.error(`[${config.pkg.name}] Error:`, error);
                        await ctx.reply(quote(`⚠️ Terjadi kesalahan: ${error.message}`));
                    }
                }
            }

            // Penanganan AFK: Pengguna yang disebutkan
            const mentionJids = m.message?.extendedTextMessage?.contextInfo?.mentionedJid;
            if (mentionJids && mentionJids.length > 0) {
                for (const mentionJid of mentionJids) {
                    const userAFK = await db.get(`user.${mentionJid}.afk`)

                    if (userAFK) {
                        const timeAgo = tools.general.convertMsToDuration(Date.now() - userAFK.timeStamp);
                        await ctx.reply(quote(`📴 Dia sedang AFK ${userAFK.reason ? `dengan alasan "${userAFK.reason}"` : "tanpa alasan"} selama ${timeAgo}.`));
                    }
                }
            }

            const userAFK = await db.get(`user.${senderId}.afk`)

            if (userAFK) {
                const currentTime = Date.now();
                const timeElapsed = currentTime - userAFK.timeStamp;

                if (timeElapsed > 3000) {
                    const timeAgo = tools.general.convertMsToDuration(timeElapsed);
                    await ctx.reply(quote(`📴 Anda telah keluar dari AFK ${userAFK.reason ? `dengan alasan "${userAFK.reason}"` : "tanpa alasan"} selama ${timeAgo}.`));
                    await db.delete(`user.${senderId}.afk`);
                }
            }
        }

        // Grup
        if (isGroup) {
            if (m.key.fromMe) return;
            const groupAutokick = await db.get(`group.${groupId}.option.autokick`);

            // Penanganan antilink
            const groupAntilink = await db.get(`group.${groupId}.option.antilink`);
            if (groupAntilink) {
                const isUrl = await tools.general.isUrl(m.content);
                if (m.content && await tools.general.isUrl(m.content) && !await tools.general.isAdmin(ctx, senderJid)) {
                    await ctx.reply(quote(`⛔ Jangan kirim tautan!`));
                    await ctx.deleteMessage(m.key);
                    if (!config.system.restrict && groupAutokick) await ctx.group().kick([senderJid]);
                }
            }

            // Penanganan antinsfw
            const groupAntinsfw = await db.get(`group.${groupId}.option.antinsfw`);
            if (groupAntinsfw) {
                const msgType = ctx.getMessageType();
                const checkMedia = await tools.general.checkMedia(msgType, "image", ctx)

                if (checkMedia && !await tools.general.isAdmin(ctx, senderJid)) {
                    const buffer = await ctx.msg.media.toBuffer();
                    const uploadUrl = await tools.general.upload(buffer);

                    const apiUrl = tools.api.createUrl("fasturl", "/tool/imagechecker", {
                        url: uploadUrl
                    }, null, ["url"]);
                    const {
                        data
                    } = await axios.get(apiUrl, {
                        headers: {
                            "x-api-key": tools.api.listUrl().fasturl.APIKey
                        }
                    });

                    if (data.results.status === "NSFW") {
                        await ctx.reply(`⛔ Jangan kirim NSFW!`);
                        await ctx.deleteMessage(m.key);
                        if (!config.system.restrict && groupAutokick) await ctx.group().kick([senderJid]);
                    }
                }
            }

            // Penanganan antisticker
            const groupAntisticker = await db.get(`group.${groupId}.option.antisticker`);
            if (groupAntisticker) {
                const msgType = ctx.getMessageType();
                const checkMedia = await tools.general.checkMedia(msgType, "sticker", ctx)

                if (checkMedia && !await tools.general.isAdmin(ctx, senderJid)) {
                    await ctx.reply(`⛔ Jangan kirim stiker!`);
                    await ctx.deleteMessage(m.key);
                    if (!config.system.restrict && groupAutokick) await ctx.group().kick([senderJid]);
                }
            }

            // Penanganan antitoxic
            const groupAntitoxic = await db.get(`group.${groupId}.option.antitoxic`);
            const toxicRegex = /anj(k|g)|ajn?(g|k)|a?njin(g|k)|bajingan|b(a?n)?gsa?t|ko?nto?l|me?me?(k|q)|pe?pe?(k|q)|meki|titi(t|d)|pe?ler|tetek|toket|ngewe|go?blo?k|to?lo?l|idiot|(k|ng)e?nto?(t|d)|jembut|bego|dajj?al|janc(u|o)k|pantek|puki ?(mak)?|kimak|kampang|lonte|col(i|mek?)|pelacur|henceu?t|nigga|fuck|dick|bitch|tits|bastard|asshole|dontol|kontoi|ontol/i;
            if (groupAntitoxic) {
                if (m.content && toxicRegex.test(m.content) && !await tools.general.isAdmin(ctx, senderJid)) {
                    await ctx.reply(quote(`⛔ Jangan toxic!`));
                    await ctx.deleteMessage(m.key);
                    if (!config.system.restrict && groupAutokick) await ctx.group().kick([senderJid]);
                }
            }
        }

        // Pribadi
        if (isPrivate) {
            if (m.key.fromMe) return;

            // Penanganan menfess
            const isCmd = tools.general.isCmd(m, ctx);
            const allMenfessDb = await db.get("menfess");
            if ((!isCmd || isCmd.didyoumean) && allMenfessDb && typeof allMenfessDb === "object" && Object.keys(allMenfessDb).length > 0) {
                const menfessEntries = Object.entries(allMenfessDb);

                for (const [conversationId, menfessData] of menfessEntries) {
                    const {
                        from,
                        to
                    } = menfessData;
                    const senderInConversation = senderId === from || senderId === to;

                    if (m.content && /^\b(delete|stop)\b$/i.test(m.content.trim()) && senderInConversation) {
                        const targetId = senderId === from ? to : from;
                        const message = "✅ Pesan menfess telah dihapus!";

                        await ctx.reply(quote(message));
                        await ctx.sendMessage(`${targetId}@s.whatsapp.net`, {
                            text: quote(message)
                        });
                        await db.delete(`menfess.${conversationId}`);
                        break;
                    }

                    if (senderInConversation) {
                        const targetId = senderId === from ? `${to}@s.whatsapp.net` : `${from}@s.whatsapp.net`;

                        await ctx._client.sendMessage(targetId, {
                            forward: m
                        });
                        await db.set(`menfess.${conversationId}.lastMsg`, Date.now());
                        break;
                    }
                }
            }
        }
    });

    // Penanganan peristiwa ketika pengguna bergabung atau keluar dari grup
    bot.ev.on(Events.UserJoin, async (m) => {
        m.eventsType = "UserJoin";
        handleUserEvent(bot, m);
    });

    bot.ev.on(Events.UserLeave, async (m) => {
        m.eventsType = "UserLeave";
        handleUserEvent(bot, m);
    });
};