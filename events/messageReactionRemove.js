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

function hasActiveWatchPartyForUser(watchPartiesData, guildId, userId, now = Date.now()) {
  return Object.values(watchPartiesData.watchParties).some(watchParty => {
    return (
      watchParty.guildId === guildId &&
      watchParty.users.includes(userId) &&
      new Date(watchParty.expiresAt).getTime() > now
    );
  });
}

module.exports = {
  name: Events.MessageReactionRemove,
  async execute(reaction, user) {
    if (user.bot) return;

    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    if (reaction.emoji.name !== '🎟️') return;
    if (!reaction.message.guild) return;

    const watchPartiesData = readWatchPartiesData();
    const watchParty = watchPartiesData.watchParties[String(reaction.message.id)];
    if (!watchParty) return;

    watchParty.users = watchParty.users.filter(id => id !== user.id);
    writeWatchPartiesData(watchPartiesData);

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const role = guild.roles.cache.get(watchParty.roleId);
    if (!role) return;

    const stillHasActiveWatchParty = hasActiveWatchPartyForUser(watchPartiesData, guild.id, user.id);

    if (!stillHasActiveWatchParty && member.roles.cache.has(role.id)) {
      await member.roles.remove(role).catch(console.error);
    }
  },
};