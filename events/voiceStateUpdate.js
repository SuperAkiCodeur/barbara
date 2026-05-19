const { Events, ChannelType } = require('discord.js');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    if (oldState.channelId === newState.channelId) return;

    const roleId = process.env.CHATTING_ROLE_ID;
    const createChannelId = process.env.CREATE_CHANNEL_ID;
    const tempCategoryId = process.env.TEMP_CATEGORY_ID;

    const joinedVoice = !oldState.channelId && !!newState.channelId;
    const leftVoice = !!oldState.channelId && !newState.channelId;
    const joinedCreateChannel = newState.channelId === createChannelId;

    try {
      if (roleId) {
        if (joinedVoice && !member.roles.cache.has(roleId)) {
          await member.roles.add(roleId);
          console.log(`✅ Rôle "Blabla" ajouté à ${member.user.tag}`);
        }

        if (leftVoice && member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId);
          console.log(`❌ Rôle "Blabla" retiré à ${member.user.tag}`);
        }
      } else {
        console.error('CHATTING_ROLE_ID manquant dans le .env');
      }

      if (joinedCreateChannel) {
        const guild = newState.guild;
        const baseName = member.displayName || member.user.username;
        const safeName = `Salon de ${baseName}`.slice(0, 100);

        const existingChannel = guild.channels.cache.find(channel =>
          channel.type === ChannelType.GuildVoice &&
          channel.parentId === tempCategoryId &&
          channel.name === safeName
        );

        if (existingChannel) {
          await member.voice.setChannel(existingChannel);
          console.log(`↪️ ${member.user.tag} déplacé vers son salon existant`);
          return;
        }

        const tempChannel = await guild.channels.create({
          name: safeName,
          type: ChannelType.GuildVoice,
          parent: tempCategoryId || null,
          reason: `Salon temporaire créé pour ${member.user.tag}`,
        });

        await member.voice.setChannel(tempChannel);
        console.log(`🎙️ Salon temporaire créé : ${safeName}`);
      }

      if (oldState.channel) {
        const oldChannel = oldState.channel;

        const isTempChannel =
          oldChannel.type === ChannelType.GuildVoice &&
          oldChannel.parentId === tempCategoryId &&
          oldChannel.id !== createChannelId;

        if (isTempChannel && oldChannel.members.size === 0) {
          await oldChannel.delete('Suppression du salon temporaire vide');
          console.log(`🗑️ Salon temporaire supprimé : ${oldChannel.name}`);
        }
      }
    } catch (error) {
      console.error('Erreur voiceStateUpdate :', error);
    }
  },
};