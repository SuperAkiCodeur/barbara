const { Events } = require('discord.js');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member) return;

    const roleId = process.env.CHATTING_ROLE_ID;
    if (!roleId) {
      console.error('CHATTING_ROLE_ID manquant dans le .env');
      return;
    }

    if (oldState.channelId === newState.channelId) return;

    const joinedVoice = !oldState.channelId && newState.channelId;
    const leftVoice = oldState.channelId && !newState.channelId;

    if (joinedVoice) {
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(roleId);
        console.log(`✅ Rôle ajouté à ${member.user.tag}`);
      }
    }

    if (leftVoice) {
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
        console.log(`❌ Rôle retiré à ${member.user.tag}`);
      }
    }
  },
};