const {
    quote,
    VCardBuilder
} = require("@mengkodingan/ckptw");
const {
    S_WHATSAPP_NET
} = require("@whiskeysockets/baileys");

module.exports = {
    name: "contact",
    aliases: ["kontak"],
    category: "anonymous_chat",
    handler: {
        banned: true,
        cooldown: true,
        private: true
    },
    code: async (ctx) => {
        const {
            status,
            message
        } = await global.handler(ctx, module.exports.handler);
        if (status) return ctx.reply(message);

        const senderNumber = ctx.sender.jid.split(/[:@]/)[0];
        const currentPartner = await global.db.get(`anonChat.${senderNumber}.partner`);

        if (!currentPartner) return ctx.reply(quote(`❎ Kamu tidak sedang dalam chat. Gunakan ${ctx._used.prefix}search untuk mencari partner.`));

        const vcard = new VCardBuilder()
            .setFullName(ctx.sender.pushName)
            .setOrg(global.config.owner.organization)
            .setNumber(senderNumber).build();

        ctx.sendMessage(currentPartner + S_WHATSAPP_NET, {
            contacts: {
                displayName: ctx.sender.pushName,
                contacts: [{
                    vcard
                }]
            }
        });
        ctx.reply(quote(`✅ Kontak telah dikirim ke partner.`));
    }
};