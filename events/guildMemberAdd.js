const { Events } = require('discord.js');

const AUTO_ROLE_ID = process.env.MEMBERS_ROLE_ID;

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    try {
      if (member.roles.cache.has(AUTO_ROLE_ID)) return;

      await member.roles.add(AUTO_ROLE_ID);
      console.log(`Rôle auto ajouté à ${member.user.tag}`);
    } catch (error) {
      console.error(`Impossible d'ajouter le rôle à ${member.user.tag} :`, error);
    }
  },
};