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

async function cleanupExpiredWatchParties(client) {
  const watchPartiesData = readWatchPartiesData();
  const now = Date.now();
  let changed = false;

  for (const [messageId, watchParty] of Object.entries(watchPartiesData.watchParties)) {
    const expired = new Date(watchParty.expiresAt).getTime() <= now;
    if (!expired) continue;

    const guild = await client.guilds.fetch(watchParty.guildId).catch(() => null);
    if (!guild) {
      delete watchPartiesData.watchParties[messageId];
      changed = true;
      continue;
    }

    for (const userId of watchParty.users) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) continue;

      const role = guild.roles.cache.get(watchParty.roleId);
      if (!role) continue;

      const stillHasAnotherActiveWatchParty = Object.entries(watchPartiesData.watchParties).some(([otherId, otherWatchParty]) => {
        if (otherId === messageId) return false;

        return (
          otherWatchParty.guildId === watchParty.guildId &&
          otherWatchParty.users.includes(userId) &&
          new Date(otherWatchParty.expiresAt).getTime() > now
        );
      });

      if (!stillHasAnotherActiveWatchParty && member.roles.cache.has(role.id)) {
        await member.roles.remove(role).catch(console.error);
      }
    }

    delete watchPartiesData.watchParties[messageId];
    changed = true;
  }

  if (changed) {
    writeWatchPartiesData(watchPartiesData);
  }
}

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);

    await cleanupExpiredWatchParties(client);

    setInterval(() => {
      cleanupExpiredWatchParties(client).catch(console.error);
    }, 5 * 60 * 1000);
  },
};