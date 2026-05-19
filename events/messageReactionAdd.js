const fs = require('fs');
const path = require('path');
const { Events } = require('discord.js');

const WATCH_PARTIES_FILE = path.join(__dirname, '..', 'data', 'watchParties.json');

function readWatchPartiesData() {
  if (!fs.existsSync(WATCH_PARTIES_FILE)) return { watchParties: {} };
  return JSON.parse(fs.readFileSync(WATCH_PARTIES_FILE, 'utf8'));
}

function writeWatchPartiesData(watchPartiesData) {
  const dir = path.dirname(WATCH_PARTIES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(WATCH_PARTIES_FILE, JSON.stringify(watchPartiesData, null, 2), 'utf8');
}

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    try {
      if (user.bot) return;

      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();

      if (reaction.emoji.name !== '🎟️') return;
      if (!reaction.message.guild) return;

      const watchPartiesData = readWatchPartiesData();
      const watchParty = watchPartiesData.watchParties[String(reaction.message.id)];
      if (!watchParty) return;

      const guild = reaction.message.guild;
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      const role = guild.roles.cache.get(watchParty.roleId) || await guild.roles.fetch(watchParty.roleId).catch(() => null);
      if (!role) return;

      if (!watchParty.users.includes(user.id)) {
        watchParty.users.push(user.id);
        writeWatchPartiesData(watchPartiesData);
      }

      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role).catch(console.error);
      }
    } catch (error) {
      console.error('Erreur messageReactionAdd :', error);
    }
  },
};